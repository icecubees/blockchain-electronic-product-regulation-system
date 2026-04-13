const axios = require("axios");
const FormData = require("form-data");

const db = require("../models");
const auditService = require("../services/audit.service");
const {
  web3,
  contract,
  accounts,
  sendContractTransaction,
} = require("../services/chain.service");

const Product = db.product;
const Order = db.order;
const User = db.user;
const Op = db.Sequelize.Op;

async function callAiAuditService(description, uploadedFile) {
  try {
    const form = new FormData();

    if (uploadedFile?.buffer) {
      form.append("file", uploadedFile.buffer, {
        filename: uploadedFile.originalname || "report.pdf",
        contentType: uploadedFile.mimetype || "application/pdf",
      });
    } else {
      form.append("file", Buffer.from(description || "", "utf-8"), {
        filename: "description.txt",
        contentType: "text/plain",
      });
    }

    const response = await axios.post("http://127.0.0.1:5000/audit", form, {
      headers: { ...form.getHeaders() },
      maxBodyLength: Infinity,
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

  const signature = web3.eth.accounts.sign(payloadHash, accounts.aiOracle.privateKey).signature;
  return { payloadHash, signature, oracleAddress: accounts.aiOracle.address };
}

async function enrichSellerReputation(product) {
  try {
    const sellerData = await contract.methods.sellers(product.seller.ethAddress).call();
    product.dataValues.sellerScore = parseInt(sellerData.reputationScore, 10);
  } catch (error) {
    product.dataValues.sellerScore = 60;
  }

  try {
    const txCount = await Order.count({
      include: [
        {
          model: Product,
          as: "product",
          where: { sellerId: product.seller.id },
        },
      ],
      where: {
        status: { [Op.in]: [1, 2] },
      },
    });
    product.dataValues.sellerTxCount = txCount;
  } catch (error) {
    product.dataValues.sellerTxCount = 0;
  }
}

function getOrderChainId(order) {
  return order.onChainId > 0 ? order.onChainId : order.id;
}

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: {
        auditStatus: 1,
        stock: { [Op.gt]: 0 },
      },
      include: [
        {
          model: User,
          as: "seller",
          attributes: ["id", "username", "isBlacklisted", "ethAddress"],
        },
      ],
    });

    const activeProducts = products.filter((product) => !product.seller.isBlacklisted);
    await Promise.all(activeProducts.map(enrichSellerReputation));

    res.send(activeProducts);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.getPendingProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { auditStatus: 0 },
      include: [{ model: User, as: "seller", attributes: ["id", "username", "ethAddress"] }],
      order: [["createdAt", "DESC"]],
    });
    res.send(products);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.getMyProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { sellerId: req.userId },
      order: [["createdAt", "DESC"]],
    });
    res.send(products);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.addProduct = async (req, res) => {
  try {
    const { name, price, description, ipfsHash, qualificationHash, stock } = req.body;
    const seller = await User.findByPk(req.userId);

    if (!seller) {
      return res.status(404).send({ message: "Seller not found" });
    }
    if (seller.role !== "seller") {
      return res.status(403).send({ message: "Only sellers can publish products" });
    }
    if (seller.status !== 1) {
      return res.status(403).send({ message: "Seller account is not approved yet" });
    }
    if (seller.isBlacklisted) {
      return res.status(403).send({ message: "Your account is blacklisted" });
    }

    const aiPassed = await callAiAuditService(description || "", req.file);

    if (!aiPassed) {
      const rejectedProduct = await Product.create({
        name,
        price,
        description,
        ipfsHash,
        qualificationHash,
        stock: parseInt(stock, 10),
        sellerId: seller.id,
        auditStatus: 2,
        auditReason: "AI audit rejected this product.",
        onChainId: 0,
        txHash: "AI_REJECTED",
      });

      await auditService.record({
        operator: req.user,
        action: "PRODUCT_AI_REJECTED",
        targetType: "PRODUCT",
        targetId: rejectedProduct.id,
        result: "SUCCESS",
        details: { name },
        req,
      });

      return res.send({
        message: "AI audit rejected this product.",
        product: rejectedProduct,
      });
    }

    const receipt = await sendContractTransaction({
      account: accounts.market,
      method: contract.methods.createProduct(
        name,
        web3.utils.toWei(price.toString(), "ether"),
        ipfsHash || "NoReport",
        qualificationHash || "NoCert",
        parseInt(stock, 10),
        seller.ethAddress
      ),
      gas: 2000000,
    });

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

    await auditService.record({
      operator: req.user,
      action: "PRODUCT_CREATED",
      targetType: "PRODUCT",
      targetId: product.id,
      result: "SUCCESS",
      details: { name, chainProductId },
      req,
      txHash: receipt.transactionHash,
    });

    res.send({
      message: "AI pre-audit passed. Waiting for regulator review.",
      product,
    });
  } catch (error) {
    console.error("Add product failed:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.auditProduct = async (req, res) => {
  try {
    const { productId, reason, decision } = req.body;
    const product = await Product.findByPk(productId);

    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }
    if (product.auditStatus !== 0) {
      return res.status(400).send({ message: "Only pending products can be audited" });
    }

    const requestedDecision = Number(decision);
    const aiPassed =
      requestedDecision === 0 ? false : await callAiAuditService(product.description || "", null);

    const chainId = product.onChainId > 0 ? product.onChainId : product.id;
    const { signature, oracleAddress } = signAiAuditResult(chainId, aiPassed);
    const receipt = await sendContractTransaction({
      account: accounts.regulator,
      method: contract.methods.auditProduct(
        chainId,
        aiPassed,
        reason || "Regulator review",
        signature
      ),
      gas: 800000,
    });

    product.auditStatus = aiPassed ? 1 : 2;
    product.auditReason = reason || (aiPassed ? "Approved by regulator review" : "Rejected by regulator review");
    product.auditBy = req.userId;
    product.auditAt = new Date();
    await product.save();

    await auditService.record({
      operator: req.user,
      action: "PRODUCT_AUDITED",
      targetType: "PRODUCT",
      targetId: product.id,
      result: "SUCCESS",
      details: {
        auditStatus: product.auditStatus,
        oracleAddress,
      },
      req,
      txHash: receipt.transactionHash,
    });

    res.send({
      message: "Audit completed with AI oracle signature.",
      auditStatus: product.auditStatus,
      aiOracleSigner: oracleAddress,
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.delistProduct = async (req, res) => {
  try {
    const { productId, reason } = req.body;
    const product = await Product.findByPk(productId);

    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }

    const isRegulator = req.user.role === "admin" || req.user.role === "regulator";
    const isSellerOwner = req.user.role === "seller" && req.user.id === product.sellerId;

    if (!isRegulator && !isSellerOwner) {
      await auditService.recordAccessDenied(req, ["seller(owner)", "regulator", "admin"]);
      return res.status(403).send({ message: "No permission to delist this product" });
    }

    const chainId = product.onChainId > 0 ? product.onChainId : product.id;
    const receipt = await sendContractTransaction({
      account: isRegulator ? accounts.regulator : accounts.market,
      method: contract.methods.delistProduct(chainId, reason || "Manual delist"),
      gas: 600000,
    });

    product.auditStatus = 2;
    product.stock = 0;
    product.delistReason = reason || "Manual delist";
    product.delistedBy = req.userId;
    product.delistedAt = new Date();
    await product.save();

    await auditService.record({
      operator: req.user,
      action: "PRODUCT_DELISTED",
      targetType: "PRODUCT",
      targetId: product.id,
      result: "SUCCESS",
      details: {
        reason: product.delistReason,
        forced: isRegulator,
      },
      req,
      txHash: receipt.transactionHash,
    });

    res.send({ message: "Product delisted successfully" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.purchaseProduct = async (req, res) => {
  try {
    const { productId } = req.body;

    const buyer = await User.findByPk(req.userId);
    const product = await Product.findByPk(productId);

    if (!buyer) {
      return res.status(404).send({ message: "Buyer not found" });
    }
    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }
    if (product.auditStatus !== 1) {
      return res.status(400).send({ message: "Product is not available for purchase" });
    }
    if (product.stock <= 0) {
      return res.status(400).send({ message: "Out of stock" });
    }

    const seller = await User.findByPk(product.sellerId);
    if (seller?.isBlacklisted) {
      return res.status(400).send({ message: "Seller is blacklisted" });
    }

    const chainId = product.onChainId > 0 ? product.onChainId : product.id;
    const receipt = await sendContractTransaction({
      account: accounts.market,
      method: contract.methods.purchaseProduct(chainId, buyer.ethAddress),
      gas: 1200000,
    });

    const chainOrderId = parseInt(await contract.methods.orderCount().call(), 10);

    await Order.create({
      productId: product.id,
      buyerId: buyer.id,
      price: product.price,
      status: 0,
      onChainId: chainOrderId,
    });

    product.stock = product.stock - 1;
    await product.save();

    await auditService.record({
      operator: req.user,
      action: "PRODUCT_PURCHASED",
      targetType: "PRODUCT",
      targetId: product.id,
      result: "SUCCESS",
      details: { chainOrderId },
      req,
      txHash: receipt.transactionHash,
    });

    res.send({ message: "Purchase successful" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Purchase failed: " + error.message });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    let orders = [];

    if (user.role === "buyer") {
      orders = await Order.findAll({
        where: { buyerId: req.userId },
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
            where: { sellerId: req.userId },
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
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.confirmReceipt = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findByPk(orderId);
    const buyer = await User.findByPk(req.userId);

    if (!order || !buyer) {
      return res.status(404).send({ message: "Order not found" });
    }
    if (order.buyerId !== buyer.id) {
      await auditService.recordAccessDenied(req, ["buyer(owner)"]);
      return res.status(403).send({ message: "You can only confirm your own order" });
    }
    if (order.status !== 0) {
      return res.status(400).send({ message: "Only locked orders can be confirmed" });
    }

    const receipt = await sendContractTransaction({
      account: accounts.market,
      method: contract.methods.confirmReceipt(getOrderChainId(order), buyer.ethAddress),
      gas: 600000,
    });

    order.status = 1;
    await order.save();

    await auditService.record({
      operator: req.user,
      action: "ORDER_CONFIRMED",
      targetType: "ORDER",
      targetId: order.id,
      result: "SUCCESS",
      req,
      txHash: receipt.transactionHash,
    });

    res.send({ message: "Receipt confirmed" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.rateOrder = async (req, res) => {
  try {
    const { orderId, rating, comment } = req.body;
    const order = await Order.findByPk(orderId);
    const buyer = await User.findByPk(req.userId);

    if (!order || !buyer) {
      return res.status(404).send({ message: "Order not found" });
    }
    if (order.buyerId !== buyer.id) {
      await auditService.recordAccessDenied(req, ["buyer(owner)"]);
      return res.status(403).send({ message: "You can only rate your own order" });
    }
    if (order.status !== 1) {
      return res.status(400).send({ message: "Only confirmed orders can be rated" });
    }

    const receipt = await sendContractTransaction({
      account: accounts.market,
      method: contract.methods.rateOrder(
        getOrderChainId(order),
        buyer.ethAddress,
        parseInt(rating, 10),
        comment || ""
      ),
      gas: 600000,
    });

    order.status = 2;
    order.rating = rating;
    order.comment = comment;
    await order.save();

    await auditService.record({
      operator: req.user,
      action: "ORDER_RATED",
      targetType: "ORDER",
      targetId: order.id,
      result: "SUCCESS",
      details: { rating },
      req,
      txHash: receipt.transactionHash,
    });

    res.send({ message: "Rated successfully" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.raiseComplaint = async (req, res) => {
  try {
    const { orderId, reason, evidenceIpfsHash } = req.body;
    const order = await Order.findByPk(orderId);
    const buyer = await User.findByPk(req.userId);

    if (!order || !buyer) {
      return res.status(404).send({ message: "Order not found" });
    }
    if (order.buyerId !== buyer.id) {
      await auditService.recordAccessDenied(req, ["buyer(owner)"]);
      return res.status(403).send({ message: "You can only complain about your own order" });
    }
    if (order.status !== 0) {
      return res.status(400).send({ message: "Only locked orders can enter complaint flow" });
    }

    const complaintText = evidenceIpfsHash
      ? `${reason} (Evidence: ipfs://${evidenceIpfsHash})`
      : reason;

    const receipt = await sendContractTransaction({
      account: accounts.market,
      method: contract.methods.raiseComplaint(
        getOrderChainId(order),
        buyer.ethAddress,
        complaintText
      ),
      gas: 600000,
    });

    order.status = 3;
    order.complaintReason = reason;
    order.evidenceIpfsHash = evidenceIpfsHash || null;
    await order.save();

    await auditService.record({
      operator: req.user,
      action: "COMPLAINT_RAISED",
      targetType: "ORDER",
      targetId: order.id,
      result: "SUCCESS",
      details: { evidenceIpfsHash: evidenceIpfsHash || null },
      req,
      txHash: receipt.transactionHash,
      ipfsHash: evidenceIpfsHash || null,
    });

    res.send({ message: "Complaint submitted" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.resolveComplaint = async (req, res) => {
  try {
    const { orderId, rulingForBuyer, rulingDetails } = req.body;
    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(404).send({ message: "Order not found" });
    }
    if (order.status !== 3) {
      return res.status(400).send({ message: "Only disputed orders can be resolved" });
    }

    const receipt = await sendContractTransaction({
      account: accounts.regulator,
      method: contract.methods.resolveComplaint(
        getOrderChainId(order),
        Boolean(rulingForBuyer),
        rulingDetails || ""
      ),
      gas: 700000,
    });

    order.status = rulingForBuyer ? 4 : 1;
    order.resolvedBy = req.userId;
    order.resolvedAt = new Date();
    order.rulingForBuyer = Boolean(rulingForBuyer);
    order.rulingDetails = rulingDetails || "";
    await order.save();

    await auditService.record({
      operator: req.user,
      action: "COMPLAINT_RESOLVED",
      targetType: "ORDER",
      targetId: order.id,
      result: "SUCCESS",
      details: {
        rulingForBuyer: Boolean(rulingForBuyer),
        rulingDetails: rulingDetails || "",
      },
      req,
      txHash: receipt.transactionHash,
    });

    res.send({ message: "Complaint resolved" });
  } catch (error) {
    res.status(500).send({ message: error.message });
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

    for (const complaint of complaints) {
      try {
        const sellerData = await contract.methods.sellers(complaint.product.seller.ethAddress).call();
        complaint.product.seller.dataValues.score = parseInt(sellerData.reputationScore, 10);
      } catch (error) {
        complaint.product.seller.dataValues.score = 60;
      }
    }

    res.send(complaints);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};
