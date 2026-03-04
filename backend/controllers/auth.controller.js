const db = require("../models");
const User = db.user;
const bcrypt = require("bcryptjs");

// 引入 ABI 和 合约地址
const contractArtifact = require("../config/ProductRegulation.json");
const CONTRACT_ADDRESS = "0x7c9deE7aD4f21a806e5B20E6d7ea94D44090F4e8"; // <--- 请核对这里是否为你刚才生成的地址！

// ==========================================
// 🛠️ Web3 初始化 (保持之前的兼容写法)
// ==========================================
let Web3;
try {
  const pkg = require("web3");
  Web3 = pkg.Web3 || pkg;
} catch (e) {
  console.log("Web3 加载降级...");
  Web3 = require("web3");
}

const GANACHE_URL = "http://127.0.0.1:7545";
const web3 = new Web3(GANACHE_URL);
// ==========================================

exports.register = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) return res.status(400).send({ message: "信息不全" });

    // 1. 生成新钱包 (此时余额为 0)
    const account = web3.eth.accounts.create();
    const hashedPassword = bcrypt.hashSync(password, 8);

    // 2. 决定初始状态
    const initialStatus = (role === 'seller') ? 0 : 1;

    // ===> 新增：上帝模式自动充值 (给新用户发 10 ETH) <===
    // 获取 Ganache 默认的第一个账号 (它有 无限 ETH)
    const adminAccounts = await web3.eth.getAccounts();
    console.log(`💰 正在给新用户 ${username} 充值 10 ETH...`);
    
    await web3.eth.sendTransaction({
        from: adminAccounts[0],
        to: account.address,
        value: web3.utils.toWei('10', 'ether')
    });
    console.log("✅ 充值成功！");
    // ===================================================

    // 3. 存入数据库
    const user = await User.create({
      username,
      password: hashedPassword,
      role: role || "buyer",
      status: initialStatus,
      ethAddress: account.address,
      ethPrivateKey: account.privateKey
    });

    if (role === 'seller') {
        res.send({ message: "注册申请已提交！请等待监管部门审核通过后方可登录。" });
    } else {
        res.send({ message: "注册成功！" });
    }

  } catch (err) {
    console.error("注册失败:", err);
    res.status(500).send({ message: err.message });
  }
};




// ==========================================
// 🔐 登录接口 (修改版：增加区块链信誉查询)
// ==========================================
const config = require("../config/auth.config");
const jwt = require("jsonwebtoken");

exports.signin = async (req, res) => {
  try {
    // 1. 查找用户
    const user = await User.findOne({
      where: {
        username: req.body.username
      }
    });

    if (!user) {
      return res.status(404).send({ message: "用户不存在！" });
    }

    // 状态检查
    if (user.status === 0) return res.status(403).send({ message: "账号正在审核中，请联系监管方。" });
    if (user.status === 2) return res.status(403).send({ message: "账号已被冻结。" });

    // 2. 验证密码
    const passwordIsValid = bcrypt.compareSync(
      req.body.password,
      user.password
    );

    if (!passwordIsValid) {
      return res.status(401).send({ accessToken: null, message: "密码错误！" });
    }

    // 3. 生成 Token
    const token = jwt.sign({ id: user.id }, config.secret, {
      expiresIn: 86400 // 24 hours
    });

    // ===> 关键修改开始：去区块链查询商家的实时信誉分 <===
    let reputationScore = 60; // 默认分
    let isBlacklisted = false;

    if (user.role === 'seller') {
        try {
            const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
            // 调用智能合约里的 sellers(address) 映射
            // 注意：Solidity 返回的是字符串数字，需要转换
            const sellerData = await contract.methods.sellers(user.ethAddress).call();
            
            // sellerData 结构: { id, walletAddress, isRegistered, reputationScore, isBlacklisted }
            if (sellerData) {
                reputationScore = parseInt(sellerData.reputationScore);
                isBlacklisted = sellerData.isBlacklisted;
                console.log(`🔍 链上查询商家 ${user.username}: ${reputationScore}分, 黑名单=${isBlacklisted}`);
            }
        } catch (chainError) {
            console.error("⚠️ 链上信誉查询失败，使用默认值:", chainError.message);
        }
    }
    // ===> 关键修改结束 <===

    // 4. 返回完整信息
    res.status(200).send({
      id: user.id,
      username: user.username,
      role: user.role,
      ethAddress: user.ethAddress,
      accessToken: token,
      // 新增字段
      reputationScore: reputationScore,
      isBlacklisted: isBlacklisted
    });

  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};



// 监管方审核商家
exports.approveSeller = async (req, res) => {
    try {
        const { sellerId, action } = req.body; // action: 'approve' | 'reject'
        
        // 1. 找到待审核的商家
        const seller = await User.findByPk(sellerId);
        if (!seller) return res.status(404).send({ message: "用户不存在" });
        if (seller.role !== 'seller') return res.status(400).send({ message: "该用户不是商家" });

        if (action === 'reject') {
            seller.status = 2; // 拒绝/冻结
            await seller.save();
            return res.send({ message: "已拒绝该商家的申请。" });
        }

        // ===> 批准流程 (执行原先注册时的上链逻辑) <===
        console.log(`👮‍♂️ 监管方正在批准商家 ${seller.username}，开始上链...`);

        // A. 自动充值 (管理员给商家转 Gas 费)
        const adminAccounts = await web3.eth.getAccounts();
        await web3.eth.sendTransaction({
            from: adminAccounts[0],
            to: seller.ethAddress,
            value: web3.utils.toWei('5', 'ether')
        });

        // B. 调用智能合约 registerSeller
        const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);
        const txData = contract.methods.registerSeller().encodeABI();
        const gasPrice = await web3.eth.getGasPrice();

        const signedTx = await web3.eth.accounts.signTransaction({
            to: CONTRACT_ADDRESS,
            from: seller.ethAddress,
            data: txData,
            gas: 2000000,
            gasPrice: gasPrice
        }, seller.ethPrivateKey);

        await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        // C. 更新数据库状态为 1 (激活)
        seller.status = 1;
        await seller.save();

        res.send({ message: "商家审核通过！账户已激活并完成链上注册。" });

    } catch (err) {
        console.error("审核失败:", err);
        res.status(500).send({ message: "审核失败: " + err.message });
    }
};

// 获取待审核商家列表
exports.getPendingSellers = async (req, res) => {
    try {
        // 查询条件：角色是商家 (seller) 且 状态是待审核 (0)
        const sellers = await User.findAll({
            where: {
                role: 'seller',
                status: 0 
            },
            attributes: ['id', 'username', 'createdAt'] // 只查这几个字段，保护隐私
        });
        res.send(sellers);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};