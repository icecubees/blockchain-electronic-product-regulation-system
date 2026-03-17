const db = require("../models");
const Product = db.product;
const Order = db.order;
const User = db.user;

const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const contractArtifact = require("../config/ProductRegulation.json");
const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS || "0x563853589af3A2433348b8E20D8547b14C6a8088";

let Web3;
try {
  const pkg = require("web3");
  Web3 = pkg.Web3 || pkg;
} catch (e) {
  Web3 = require("web3");
}

const web3 = new Web3(process.env.GANACHE_URL || "http://127.0.0.1:7545");

const AI_ORACLE_PRIVATE_KEY =
  process.env.AI_ORACLE_PRIVATE_KEY ||
  "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce036f4f5f9e5d7b8c6a7d1";
const aiOracleAccount = web3.eth.accounts.privateKeyToAccount(AI_ORACLE_PRIVATE_KEY);

function cleanupUploadedFile(uploadedFile) {
  if (uploadedFile && uploadedFile.path && fs.existsSync(uploadedFile.path)) {
    fs.unlinkSync(uploadedFile.path);
  }
}

async function callAiAuditService(description, filePath) {
  try {
    const form = new FormData();

    if (filePath) {
      form.append("file", fs.createReadStream(filePath));
    } else {
      form.append("file", Buffer.from(description || "", "utf-8"), {
        filename: "description.txt",
        contentType: "text/plain",
      });
    }

    const response = await axios.post("http://127.0.0.1:5000/audit", form, {
      headers: { ...form.getHeaders() },
    });

    return response.data.result === "PASS";
  } catch (error) {
    console.error("AI service call failed:", error.message);
    return false;
  }
}

function signAiAuditResult(productId, isPass) {
  const payloadHash = web3.utils.soliditySha3(
    { type: "uint256", value: Number(productId) },
    { type: "bool", value: Boolean(isPass) }
  );

  const signature = web3.eth.accounts.sign(payloadHash, AI_ORACLE_PRIVATE_KEY).signature;
  return { payloadHash, signature, oracleAddress: aiOracleAccount.address };
}

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: {
        auditStatus: 1,
        stock: { [db.Sequelize.Op.gt]: 0 },
      },
      include: [
        {
          model: User,
          as: "seller",
          attributes: ["id", "username", "isBlacklisted", "ethAddress"],
        },
      ],
    });

    const activeProducts = products.filter((p) => !p.seller.isBlacklisted);
    const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);

    for (const p of activeProducts) {
      try {
        const sellerData = await contract.methods.sellers(p.seller.ethAddress).call();
        p.dataValues.sellerScore = parseInt(sellerData.reputationScore, 10);
      } catch (e) {
        p.dataValues.sellerScore = 60;
      }

      try {
        const txCount = await Order.count({
          include: [
            {
              model: Product,
              as: "product",
              where: { sellerId: p.seller.id },
            },
          ],
          where: {
            status: { [db.Sequelize.Op.in]: [1, 2] },
          },
        });
        p.dataValues.sellerTxCount = txCount;
      } catch (e) {
        p.dataValues.sellerTxCount = 0;
      }
    }

    res.send(activeProducts);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.getPendingProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { auditStatus: 0 },
      include: [{ model: User, as: "seller" }],
    });
    res.send(products);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.getMyProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { sellerId: req.userId },
      order: [["createdAt", "DESC"]],
    });
    res.send(products);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.addProduct = async (req, res) => {
  const uploadedFile = req.file;

  try {
    const { name, price, description, ipfsHash, qualificationHash, stock } = req.body;
    const seller = await User.findByPk(req.userId);

    if (!seller) {
      cleanupUploadedFile(uploadedFile);
      return res.status(404).send({ message: "Seller not found" });
    }

    if (seller.isBlacklisted) {
      cleanupUploadedFile(uploadedFile);
      return res.status(403).send({ message: "Your account is blacklisted" });
    }

    const aiPassed = await callAiAuditService(
      description || "",
      uploadedFile ? uploadedFile.path : null
    );

    cleanupUploadedFile(uploadedFile);

    if (!aiPassed) {
      const product = await Product.create({
        name,
        price,
        description,
        ipfsHash,
        qualificationHash,
        stock: parseInt(stock, 10),
        sellerId: seller.id,
        auditStatus: 2,
        onChainId: 0,
        txHash: "AI_REJECTED",
      });

      return res.send({
        message: "AI audit rejected this product.",
        product,
      });
    }

    const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
    const txData = contract.methods
      .createProduct(
        name,
        web3.utils.toWei(price.toString(), "ether"),
        ipfsHash || "NoReport",
        qualificationHash || "NoCert",
        parseInt(stock, 10),
        false
      )
      .encodeABI();

    const gasPrice = await web3.eth.getGasPrice();
    const signedTx = await web3.eth.accounts.signTransaction(
      {
        to: CONTRACT_ADDRESS,
        from: seller.ethAddress,
        data: txData,
        gas: 2000000,
        gasPrice,
      },
      seller.ethPrivateKey
    );

    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    const chainProductId = parseInt(await contract.methods.productCount().call(), 10);

    const product = await Product.create({
      name,
      price,
      description,
      ipfsHash,
      qualificationHash,
      stock: parseInt(stock, 10),
      sellerId: seller.id,
      auditStatus: 0,
      txHash: receipt.transactionHash,
      onChainId: chainProductId,
    });

    res.send({
      message: "AI pre-audit passed. Waiting for regulator review.",
      product,
    });
  } catch (err) {
    cleanupUploadedFile(uploadedFile);
    console.error("Add product failed:", err);
    res.status(500).send({ message: err.message });
  }
};

exports.auditProduct = async (req, res) => {
  try {
    const { productId, reason } = req.body;

    const regulator = await User.findByPk(req.userId);
    const product = await Product.findByPk(productId);

    if (!regulator) return res.status(404).send({ message: "Regulator not found" });
    if (!product) return res.status(404).send({ message: "Product not found" });

    const chainId = product.onChainId > 0 ? product.onChainId : product.id;
    const aiPassed = await callAiAuditService(product.description || "", null);
    const { signature, oracleAddress } = signAiAuditResult(chainId, aiPassed);

    const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
    const txData = contract.methods
      .auditProduct(chainId, aiPassed, reason || "AI oracle audit", signature)
      .encodeABI();

    const gasPrice = await web3.eth.getGasPrice();
    const signedTx = await web3.eth.accounts.signTransaction(
      {
        to: CONTRACT_ADDRESS,
        from: regulator.ethAddress,
        data: txData,
        gas: 600000,
        gasPrice,
      },
      regulator.ethPrivateKey
    );

    await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    product.auditStatus = aiPassed ? 1 : 2;
    await product.save();

    res.send({
      message: "Audit completed with AI oracle signature.",
      auditStatus: product.auditStatus,
      aiOracleSigner: oracleAddress,
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.delistProduct = async (req, res) => {
  try {
    const { productId, reason } = req.body;

    const operator = await User.findByPk(req.userId);
    const product = await Product.findByPk(productId);

    if (!operator) return res.status(404).send({ message: "User not found" });
    if (!product) return res.status(404).send({ message: "Product not found" });

    const isRegulator = operator.role === "admin" || operator.role === "regulator";
    const isSeller = operator.id === product.sellerId;

    if (!isRegulator && !isSeller) {
      return res.status(403).send({ message: "No permission to delist" });
    }

    const chainId = product.onChainId > 0 ? product.onChainId : product.id;
    const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);

    const txData = contract.methods
      .delistProduct(chainId, reason || "Manual delist")
      .encodeABI();

    const gasPrice = await web3.eth.getGasPrice();
    const signedTx = await web3.eth.accounts.signTransaction(
      {
        to: CONTRACT_ADDRESS,
        from: operator.ethAddress,
        data: txData,
        gas: 500000,
        gasPrice,
      },
      operator.ethPrivateKey
    );

    await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    product.auditStatus = 2;
    product.stock = 0;
    await product.save();

    res.send({ message: "Product delisted successfully" });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.purchaseProduct = async (req, res) => {
  try {
    const { productId } = req.body;

    const buyer = await User.findByPk(req.userId);
    const product = await Product.findByPk(productId);

    if (!buyer) return res.status(404).send({ message: "Buyer not found" });
    if (!product) return res.status(404).send({ message: "Product not found" });

    const seller = await User.findByPk(product.sellerId);
    if (seller.isBlacklisted) {
      return res.status(400).send({ message: "Seller is blacklisted" });
    }

    if (product.stock <= 0) {
      return res.status(400).send({ message: "Out of stock" });
    }

    const chainId = product.onChainId > 0 ? product.onChainId : product.id;
    const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
    const txData = contract.methods.purchaseProduct(chainId).encodeABI();

    const priceInWei = web3.utils.toWei(product.price.toString(), "ether");
    const gasPrice = await web3.eth.getGasPrice();

    const signedTx = await web3.eth.accounts.signTransaction(
      {
        to: CONTRACT_ADDRESS,
        from: buyer.ethAddress,
        data: txData,
        gas: 2000000,
        gasPrice,
        value: priceInWei,
      },
      buyer.ethPrivateKey
    );

    await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    await Order.create({
      productId: product.id,
      buyerId: buyer.id,
      price: product.price,
      status: 0,
      onChainId: 0,
    });

    product.stock = product.stock - 1;
    await product.save();

    res.send({ message: "Purchase successful" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Purchase failed: " + err.message });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findByPk(userId);
    let orders = [];

    if (user.role === "buyer") {
      orders = await Order.findAll({
        where: { buyerId: userId },
        include: [
          {
            model: Product,
            as: "product",
            include: [{ model: User, as: "seller", attributes: ["username"] }],
          },
        ],
        order: [["createdAt", "DESC"]],
      });
    } else if (user.role === "seller") {
      orders = await Order.findAll({
        include: [
          {
            model: Product,
            as: "product",
            where: { sellerId: userId },
          },
          {
            model: User,
            as: "buyer",
            attributes: ["username"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });
    }

    res.send(orders);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.confirmReceipt = async (req, res) => {
  try {
    const { orderId } = req.body;
    const buyer = await User.findByPk(req.userId);
    const order = await Order.findByPk(orderId);
    const chainOrderId = order.id;

    const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
    const txData = contract.methods.confirmReceipt(chainOrderId).encodeABI();

    const gasPrice = await web3.eth.getGasPrice();
    const signedTx = await web3.eth.accounts.signTransaction(
      {
        to: CONTRACT_ADDRESS,
        from: buyer.ethAddress,
        data: txData,
        gas: 2000000,
        gasPrice,
      },
      buyer.ethPrivateKey
    );

    await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    order.status = 1;
    await order.save();
    res.send({ message: "Receipt confirmed" });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.rateOrder = async (req, res) => {
  try {
    const { orderId, rating, comment } = req.body;
    const buyer = await User.findByPk(req.userId);
    const order = await Order.findByPk(orderId);
    const chainOrderId = order.id;

    const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
    const txData = contract.methods
      .rateOrder(chainOrderId, parseInt(rating, 10), comment)
      .encodeABI();

    const gasPrice = await web3.eth.getGasPrice();
    const signedTx = await web3.eth.accounts.signTransaction(
      {
        to: CONTRACT_ADDRESS,
        from: buyer.ethAddress,
        data: txData,
        gas: 500000,
        gasPrice,
      },
      buyer.ethPrivateKey
    );

    await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    order.status = 2;
    order.rating = rating;
    order.comment = comment;
    await order.save();

    res.send({ message: "Rated successfully" });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.raiseComplaint = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const buyer = await User.findByPk(req.userId);
    const order = await Order.findByPk(orderId);
    const chainOrderId = order.id;

    const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
    const txData = contract.methods.raiseComplaint(chainOrderId, reason).encodeABI();

    const gasPrice = await web3.eth.getGasPrice();
    const signedTx = await web3.eth.accounts.signTransaction(
      {
        to: CONTRACT_ADDRESS,
        from: buyer.ethAddress,
        data: txData,
        gas: 500000,
        gasPrice,
      },
      buyer.ethPrivateKey
    );

    await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    order.status = 3;
    order.complaintReason = reason;
    await order.save();

    res.send({ message: "Complaint submitted" });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.resolveComplaint = async (req, res) => {
  try {
    const { orderId, rulingForBuyer, rulingDetails } = req.body;

    const regulator = await User.findByPk(req.userId);
    const order = await Order.findByPk(orderId);
    const chainOrderId = order.id;

    const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
    const txData = contract.methods
      .resolveComplaint(chainOrderId, rulingForBuyer, rulingDetails || "")
      .encodeABI();

    const gasPrice = await web3.eth.getGasPrice();
    const signedTx = await web3.eth.accounts.signTransaction(
      {
        to: CONTRACT_ADDRESS,
        from: regulator.ethAddress,
        data: txData,
        gas: 500000,
        gasPrice,
      },
      regulator.ethPrivateKey
    );

    await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    order.status = rulingForBuyer ? 4 : 1;
    await order.save();

    res.send({ message: "Complaint resolved" });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.getAllComplaints = async (req, res) => {
  try {
    const complaints = await Order.findAll({
      where: { status: 3 },
      include: [
        {
          model: Product,
          as: "product",
          include: [{ model: User, as: "seller", attributes: ["username", "id", "ethAddress"] }],
        },
        {
          model: User,
          as: "buyer",
          attributes: ["username", "id"],
        },
      ],
      order: [["updatedAt", "DESC"]],
    });

    const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
    for (const c of complaints) {
      try {
        const sellerData = await contract.methods.sellers(c.product.seller.ethAddress).call();
        c.product.seller.dataValues.score = parseInt(sellerData.reputationScore, 10);
      } catch (e) {
        c.product.seller.dataValues.score = 60;
      }
    }

    res.send(complaints);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

