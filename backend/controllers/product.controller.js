const db = require("../models");
const Product = db.product;
const Order = db.order;
const User = db.user;

const axios = require('axios');
const FormData = require('form-data');
// 引入 fs 模块用于读取上传的临时文件
const fs = require('fs'); 

const contractArtifact = require("../config/ProductRegulation.json");
// ⚠️ 您的新地址
const CONTRACT_ADDRESS = "0x7c9deE7aD4f21a806e5B20E6d7ea94D44090F4e8"; 

let Web3;
try {
  const pkg = require("web3");
  Web3 = pkg.Web3 || pkg;
} catch (e) {
  Web3 = require("web3");
}
const web3 = new Web3("http://127.0.0.1:7545");

// ==========================================
// 🤖 升级版 AI 调用：支持文本 + PDF 文件
// ==========================================
async function callAiAuditService(description, filePath) {
    console.log(`🤖 正在请求 AI 审核...`);
    
    try {
        const form = new FormData();
        
        // 1. 如果有 PDF 文件，直接把文件流发给 Python
        if (filePath) {
            console.log(`📄 附带 PDF 文件: ${filePath}`);
            form.append('file', fs.createReadStream(filePath));
        } else {
            // 2. 如果只有文本，伪装成 txt 文件
            console.log(`📝 仅发送文本描述`);
            form.append('file', Buffer.from(description, 'utf-8'), {
                filename: 'description.txt',
                contentType: 'text/plain',
            });
        }

        const response = await axios.post('http://127.0.0.1:5000/audit', form, {
            headers: { ...form.getHeaders() }
        });

        const result = response.data.result; 
        console.log(`🤖 AI 结果: ${result}`);
        return result === 'PASS'; 

    } catch (error) {
        console.error("❌ AI 服务调用失败:", error.message);
        return false; // 默认拒绝
    }
}

// ==========================================
// 📦 商品管理接口
// ==========================================


exports.getAllProducts = async (req, res) => {
    try {
        const products = await Product.findAll({
            where: { 
                auditStatus: 1, 
                stock: { [db.Sequelize.Op.gt]: 0 } 
            },
            // 确保把商家的 id 查出来
            include: [{ model: User, as: 'seller', attributes: ['id', 'username', 'isBlacklisted', 'ethAddress'] }]
        });
        
        const activeProducts = products.filter(p => !p.seller.isBlacklisted);

        const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
        
        for (let p of activeProducts) {
            // 1. 查区块链信誉分
            try {
                const sellerData = await contract.methods.sellers(p.seller.ethAddress).call();
                p.dataValues.sellerScore = parseInt(sellerData.reputationScore);
            } catch (e) {
                p.dataValues.sellerScore = 60; 
            }

            // ===> 2. 查数据库：真实履约次数 <===
            try {
                const txCount = await Order.count({
                    include: [{
                        model: Product,
                        as: 'product',
                        where: { sellerId: p.seller.id } // 查该商家发布的所有商品的订单
                    }],
                    where: {
                        // 1 = 已收货/卖方胜诉, 2 = 已评价 (算作履约成功)
                        status: { [db.Sequelize.Op.in]: [1, 2] } 
                    }
                });
                p.dataValues.sellerTxCount = txCount;
            } catch (e) {
                console.error("查履约次数失败:", e);
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
            include: [{ model: User, as: 'seller' }]
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
            order: [['createdAt', 'DESC']]
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
        const userId = req.userId;

        const seller = await User.findByPk(userId);
        if (!seller) {
            if (uploadedFile) fs.unlinkSync(uploadedFile.path);
            return res.status(404).send({ message: "商家不存在" });
        }
        
        // 1. 黑名单拦截
        if (seller.isBlacklisted) {
            if (uploadedFile) fs.unlinkSync(uploadedFile.path);
            return res.status(403).send({ message: "您已被列入黑名单，禁止发布商品！" });
        }

        console.log(`📦 商家提交上架申请: ${name}`);

        // 2. AI 智能初审
        const aiPassed = await callAiAuditService(
            description || "", 
            uploadedFile ? uploadedFile.path : null
        );
        
        // 清理临时文件
        if (uploadedFile) fs.unlinkSync(uploadedFile.path);

        // ===> 分支 A: AI 拒绝 (流程结束) <===
        if (!aiPassed) {
             const product = await Product.create({
                name, price, description, ipfsHash, qualificationHash,
                stock: parseInt(stock), 
                sellerId: seller.id,
                auditStatus: 2, // 2 = AI拒绝
                onChainId: 0,
                txHash: "AI_REJECTED"
            });
            return res.send({ message: "⚠️ AI 智能审核未通过：检测到违规内容，已自动拦截。", product });
        }

        // ===> 分支 B: AI 通过 -> 进入人工审核 (关键修改) <===
        
        const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
        const txData = contract.methods.createProduct(
            name, 
            web3.utils.toWei(price.toString(), 'ether'), 
            ipfsHash || "NoReport", 
            qualificationHash || "NoCert", 
            parseInt(stock), 
            false // ⚠️ 关键点：链上初始设为 false (不可买)，等待监管者改为 true
        ).encodeABI();

        const gasPrice = await web3.eth.getGasPrice();
        const signedTx = await web3.eth.accounts.signTransaction({
            to: CONTRACT_ADDRESS,
            from: seller.ethAddress,
            data: txData,
            gas: 2000000,
            gasPrice: gasPrice
        }, seller.ethPrivateKey);

        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        // 存入数据库
        const product = await Product.create({
            name, price, description, ipfsHash, qualificationHash,
            stock: parseInt(stock), 
            sellerId: seller.id,
            auditStatus: 0, // ⚠️ 关键点：0 = Pending (待人工审核)
            txHash: receipt.transactionHash,
            onChainId: 0 
        });

        // 3. 返回成功消息 (告诉前端：去排队吧)
        res.send({ 
            message: "✅ AI 初审通过！已提交至监管平台，请耐心等待人工复核。", 
            product 
        });

    } catch (err) {
        console.error("上架失败:", err);
        if (uploadedFile && fs.existsSync(uploadedFile.path)) {
            fs.unlinkSync(uploadedFile.path);
        }
        res.status(500).send({ message: err.message });
    }
};

exports.auditProduct = async (req, res) => {
    // ... (保持原逻辑，略)
    // 为了代码完整性，请把之前的 auditProduct 代码粘贴在这里
    // 记得 Contract 方法签名没变
     try {
        const { productId, decision, reason } = req.body; 
        const regulator = await User.findByPk(req.userId);
        const product = await Product.findByPk(productId);
        
        const chainId = (product.onChainId > 0) ? product.onChainId : product.id;
        const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
        
        const isPass = (decision === 1);
        const txData = contract.methods.auditProduct(chainId, isPass, reason||"").encodeABI();

        const gasPrice = await web3.eth.getGasPrice();
        const signedTx = await web3.eth.accounts.signTransaction({
            to: CONTRACT_ADDRESS, from: regulator.ethAddress, data: txData, gas: 500000, gasPrice: gasPrice
        }, regulator.ethPrivateKey);
        await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        product.auditStatus = decision;
        await product.save();
        res.send({ message: "审核完成" });
    } catch (err) { res.status(500).send({ message: err.message }); }
};

// ==========================================
// 🛍️ 订单接口
// ==========================================

exports.purchaseProduct = async (req, res) => {
    try {
        const { productId } = req.body;
        const buyer = await User.findByPk(req.userId);
        const product = await Product.findByPk(productId);
        
        // 检查商家是否被拉黑
        const seller = await User.findByPk(product.sellerId);
        if (seller.isBlacklisted) {
            return res.status(400).send({ message: "该商家信誉过低，已被平台冻结，无法购买！" });
        }

        if (product.stock <= 0) return res.status(400).send({ message: "库存不足" });

        const chainId = (product.onChainId > 0) ? product.onChainId : product.id;
        const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
        const txData = contract.methods.purchaseProduct(chainId).encodeABI();
        
        const priceInWei = web3.utils.toWei(product.price.toString(), 'ether');
        const gasPrice = await web3.eth.getGasPrice();

        const signedTx = await web3.eth.accounts.signTransaction({
            to: CONTRACT_ADDRESS, from: buyer.ethAddress, data: txData, gas: 2000000, gasPrice: gasPrice, value: priceInWei 
        }, buyer.ethPrivateKey);

        await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        await Order.create({
            productId: product.id,
            buyerId: buyer.id,
            price: product.price,
            status: 0, // Locked
            onChainId: 0
        });

        product.stock = product.stock - 1;
        await product.save();

        res.send({ message: "购买成功" });
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "购买失败: " + err.message });
    }
};

exports.getMyOrders = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findByPk(userId);
        let orders = [];

        if (user.role === 'buyer') {
            orders = await Order.findAll({ 
                where: { buyerId: userId },
                include: [{ 
                    model: Product, as: 'product',
                    include: [{ model: User, as: 'seller', attributes: ['username'] }]
                }], 
                order: [['createdAt', 'DESC']]
            });
        } else if (user.role === 'seller') {
            orders = await Order.findAll({
                include: [{ 
                    model: Product, as: 'product', where: { sellerId: userId } 
                }, {
                    model: User, as: 'buyer', attributes: ['username'] 
                }],
                order: [['createdAt', 'DESC']]
            });
        }
        res.send(orders);
    } catch (err) { res.status(500).send({ message: err.message }); }
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
        const signedTx = await web3.eth.accounts.signTransaction({
            to: CONTRACT_ADDRESS, from: buyer.ethAddress, data: txData, gas: 2000000, gasPrice: gasPrice
        }, buyer.ethPrivateKey);

        await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        order.status = 1; // Released (待评价)
        await order.save();
        res.send({ message: "收货成功，请评价！" });
    } catch (err) { res.status(500).send({ message: err.message }); }
};

// ===> 新增：评价订单
exports.rateOrder = async (req, res) => {
    try {
        const { orderId, rating, comment } = req.body;
        const buyer = await User.findByPk(req.userId);
        const order = await Order.findByPk(orderId);
        const chainOrderId = order.id;

        console.log(`⭐ 评价订单 ${chainOrderId}: ${rating}星 - ${comment}`);

        const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
        const txData = contract.methods.rateOrder(chainOrderId, parseInt(rating), comment).encodeABI();
        
        const gasPrice = await web3.eth.getGasPrice();
        const signedTx = await web3.eth.accounts.signTransaction({
            to: CONTRACT_ADDRESS, from: buyer.ethAddress, data: txData, gas: 500000, gasPrice: gasPrice
        }, buyer.ethPrivateKey);

        await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        order.status = 2; // Completed
        order.rating = rating;
        order.comment = comment;
        await order.save();

        res.send({ message: "评价成功！" });
    } catch (err) { res.status(500).send({ message: err.message }); }
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
        const signedTx = await web3.eth.accounts.signTransaction({
            to: CONTRACT_ADDRESS, from: buyer.ethAddress, data: txData, gas: 500000, gasPrice: gasPrice
        }, buyer.ethPrivateKey);
        await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        order.status = 3; // Disputed
        order.complaintReason = reason;
        await order.save();
        res.send({ message: "已投诉" });
    } catch (err) { res.status(500).send({ message: err.message }); }
};

exports.resolveComplaint = async (req, res) => {
    try {
        const { orderId, rulingForBuyer, rulingDetails } = req.body;
        const regulator = await User.findByPk(req.userId);
        const order = await Order.findByPk(orderId);
        const chainOrderId = order.id;

        const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
        const txData = contract.methods.resolveComplaint(chainOrderId, rulingForBuyer, rulingDetails||"").encodeABI();
        
        const gasPrice = await web3.eth.getGasPrice();
        const signedTx = await web3.eth.accounts.signTransaction({
            to: CONTRACT_ADDRESS, from: regulator.ethAddress, data: txData, gas: 500000, gasPrice: gasPrice
        }, regulator.ethPrivateKey);
        await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        order.status = rulingForBuyer ? 4 : 1; // 4=Refunded, 1=Released(卖家赢)
        await order.save();

        // 检查卖家是否被拉黑 (因为合约里可能已经拉黑了)
        // 这里只是为了同步数据库状态，其实链上已经生效了
        if (rulingForBuyer) {
            const product = await Product.findByPk(order.productId);
            const seller = await User.findByPk(product.sellerId);
            // 简单逻辑：如果这是第二次严重败诉，或者我们可以读链上状态
            // 为了简化，我们假设监管方手动去冻结，或者信任链上逻辑
        }

        res.send({ message: "裁决生效" });
    } catch (err) { res.status(500).send({ message: err.message }); }
};
// ===> 新增：监管者获取所有投诉订单
exports.getAllComplaints = async (req, res) => {
    try {
        const complaints = await Order.findAll({
            where: { status: 3 },
            include: [
                { 
                    model: Product, 
                    as: 'product',
                    // ===> 关键修改3：包含 ethAddress <===
                    include: [{ model: User, as: 'seller', attributes: ['username', 'id', 'ethAddress'] }] 
                },
                { 
                    model: User, 
                    as: 'buyer', 
                    attributes: ['username', 'id'] 
                }
            ],
            order: [['updatedAt', 'DESC']]
        });

        // ===> 关键修改4：查出被投诉商家的实时信誉分 <===
        const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
        for (let c of complaints) {
            try {
                const sellerData = await contract.methods.sellers(c.product.seller.ethAddress).call();
                // 附加到 seller 对象上
                c.product.seller.dataValues.score = parseInt(sellerData.reputationScore);
            } catch (e) {
                c.product.seller.dataValues.score = 60;
            }
        }

        res.send(complaints);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};