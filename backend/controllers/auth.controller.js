const db = require("../models");
const User = db.user;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const contractArtifact = require("../config/ProductRegulation.json");
const config = require("../config/auth.config");
const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS || "0x563853589af3A2433348b8E20D8547b14C6a8088";

let Web3;
try {
  const pkg = require("web3");
  Web3 = pkg.Web3 || pkg;
} catch (e) {
  Web3 = require("web3");
}

const GANACHE_URL = process.env.GANACHE_URL || "http://127.0.0.1:7545";
const web3 = new Web3(GANACHE_URL);

exports.register = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).send({ message: "Missing username or password" });
    }

    const existed = await User.findOne({ where: { username } });
    if (existed) {
      return res.status(400).send({ message: "Username already exists" });
    }

    const account = web3.eth.accounts.create();
    const hashedPassword = bcrypt.hashSync(password, 8);
    const initialStatus = role === "seller" ? 0 : 1;

    const adminAccounts = await web3.eth.getAccounts();
    await web3.eth.sendTransaction({
      from: adminAccounts[0],
      to: account.address,
      value: web3.utils.toWei("10", "ether"),
    });

    await User.create({
      username,
      password: hashedPassword,
      role: role || "buyer",
      status: initialStatus,
      ethAddress: account.address,
      ethPrivateKey: account.privateKey,
    });

    if (role === "seller") {
      return res.send({ message: "Seller registration submitted, waiting for approval." });
    }

    return res.send({ message: "Registration successful" });
  } catch (err) {
    console.error("Register failed:", err);
    return res.status(500).send({ message: err.message });
  }
};

exports.signin = async (req, res) => {
  try {
    const user = await User.findOne({ where: { username: req.body.username } });
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    if (user.status === 0) {
      return res.status(403).send({ message: "Account is pending approval" });
    }
    if (user.status === 2) {
      return res.status(403).send({ message: "Account is frozen" });
    }

    const passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
    if (!passwordIsValid) {
      return res.status(401).send({ accessToken: null, message: "Invalid password" });
    }

    const token = jwt.sign({ id: user.id }, config.secret, { expiresIn: 86400 });

    let reputationScore = 60;
    let isBlacklisted = false;

    if (user.role === "seller") {
      try {
        const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
        const sellerData = await contract.methods.sellers(user.ethAddress).call();

        if (sellerData) {
          reputationScore = parseInt(sellerData.reputationScore, 10);
          isBlacklisted = sellerData.isBlacklisted;
        }
      } catch (chainError) {
        console.error("Chain reputation lookup failed:", chainError.message);
      }
    }

    return res.status(200).send({
      id: user.id,
      username: user.username,
      role: user.role,
      ethAddress: user.ethAddress,
      accessToken: token,
      reputationScore,
      isBlacklisted,
    });
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
};

exports.approveSeller = async (req, res) => {
  try {
    const { sellerId, action } = req.body;

    const seller = await User.findByPk(sellerId);
    if (!seller) return res.status(404).send({ message: "User not found" });
    if (seller.role !== "seller") return res.status(400).send({ message: "Not a seller account" });

    if (action === "reject") {
      seller.status = 2;
      await seller.save();
      return res.send({ message: "Seller request rejected" });
    }

    const adminAccounts = await web3.eth.getAccounts();
    await web3.eth.sendTransaction({
      from: adminAccounts[0],
      to: seller.ethAddress,
      value: web3.utils.toWei("5", "ether"),
    });

    const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
    const txData = contract.methods.registerSeller().encodeABI();
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

    await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    seller.status = 1;
    await seller.save();

    return res.send({ message: "Seller approved and activated" });
  } catch (err) {
    console.error("Approve seller failed:", err);
    return res.status(500).send({ message: "Approval failed: " + err.message });
  }
};

exports.getPendingSellers = async (req, res) => {
  try {
    const sellers = await User.findAll({
      where: {
        role: "seller",
        status: 0,
      },
      attributes: ["id", "username", "createdAt"],
    });

    return res.send(sellers);
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
};

