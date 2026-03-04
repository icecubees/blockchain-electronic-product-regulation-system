// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ProductRegulation {
    
    // ============================
    // 1. 数据结构定义
    // ============================
    
    struct Product {
        uint id;
        string name;
        uint price;         // 单价 (wei)
        string ipfsHash;    // 检测报告 Hash
        string qualificationHash; // ===> 新增：资质证书 Hash (溯源增强)
        uint stock;         
        bool isAudited;     
        address payable seller; 
        bool exists;
    }

    // 订单状态枚举
    enum OrderState { 
        Locked,     // 0: 已付款 (待收货)
        Released,   // 1: 已完成 (已收货，资金已放，待评价)
        Completed,  // 2: 已评价 (流程彻底终结) <=== 新增状态
        Disputed,   // 3: 投诉中
        Refunded    // 4: 已退款 (买家胜诉)
    }

    struct Order {
        uint id;            
        uint productId;     
        address payable buyer; 
        uint price;         
        OrderState state;   
        string complaintReason; 
        // ===> 新增：评价信息
        uint rating;        // 评分 (1-5)
        string comment;     // 评论内容
    }

    struct Seller {
        uint id;
        address walletAddress;
        bool isRegistered;
        int reputationScore; // 信誉分
        bool isBlacklisted;  // ===> 新增：黑名单状态 (交易冻结)
    }

    // ============================
    // 2. 状态变量
    // ============================
    uint public productCount = 0;
    uint public orderCount = 0;   
    uint public sellerCount = 0;

    mapping(uint => Product) public products; 
    mapping(uint => Order) public orders;     
    mapping(address => Seller) public sellers;

    // ============================
    // 3. 事件 (日志)
    // ============================
    event ProductCreated(uint id, string name, uint stock, address seller);
    event ProductAudited(uint id, bool pass, string reason);
    
    event OrderCreated(uint orderId, uint productId, address buyer); 
    event OrderConfirmed(uint orderId, address buyer);               
    event OrderRated(uint orderId, uint rating, string comment); // ===> 新增：评价事件
    
    event ComplaintRaised(uint orderId, address buyer, string reason);
    event ComplaintResolved(uint orderId, bool buyerWon);
    
    event SellerRegistered(uint id, address seller, int score);
    event SellerBlacklisted(address seller, string reason); // ===> 新增：黑名单事件

    // ============================
    // 4. 核心功能函数
    // ============================

    // --- A. 商家注册 ---
    function registerSeller() public {
        require(!sellers[msg.sender].isRegistered, "Seller already registered");
        sellerCount++;
        // 初始化：60分，未被拉黑
        sellers[msg.sender] = Seller(sellerCount, msg.sender, true, 60, false);
        emit SellerRegistered(sellerCount, msg.sender, 60);
    }

    // --- B. 商品上架 (带库存 + 资质证书 + 黑名单检查) ---
    function createProduct(
        string memory _name, 
        uint _price, 
        string memory _ipfsHash, 
        string memory _qualificationHash, // ===> 新增参数
        uint _stock, 
        bool _initialPass
    ) public {
        require(sellers[msg.sender].isRegistered, "Only sellers");
        require(!sellers[msg.sender].isBlacklisted, "Seller is blacklisted"); // ===> 被拉黑无法上架
        require(_price > 0, "Price > 0");
        require(_stock > 0, "Stock > 0");

        productCount++;
        products[productCount] = Product(
            productCount, 
            _name, 
            _price, 
            _ipfsHash, 
            _qualificationHash, // 写入链上
            _stock,       
            _initialPass, 
            payable(msg.sender), 
            true
        );
        emit ProductCreated(productCount, _name, _stock, msg.sender);
    }

    // --- C. 监管审核商品 ---
    function auditProduct(uint _id, bool _pass, string memory _reason) public {
        require(_id > 0 && _id <= productCount, "Invalid ID");
        products[_id].isAudited = _pass; 
        emit ProductAudited(_id, _pass, _reason);
    }

    // --- D. 买家购买 ---
    function purchaseProduct(uint _productId) public payable {
        Product storage p = products[_productId];
        
        require(p.exists, "Product not found");
        require(p.isAudited, "Product not audited"); 
        require(p.stock > 0, "Out of stock");        
        require(msg.value >= p.price, "Not enough Ether");
        require(p.seller != msg.sender, "Seller cannot buy own");
        require(!sellers[p.seller].isBlacklisted, "Seller is blacklisted"); // ===> 商家被拉黑则无法购买

        // 1. 扣减库存
        p.stock = p.stock - 1;

        // 2. 生成新订单
        orderCount++;
        orders[orderCount] = Order(
            orderCount,
            _productId,
            payable(msg.sender),
            p.price,
            OrderState.Locked, // 初始状态：锁定
            "",
            0,  // 初始评分 0
            ""  // 初始评论空
        );

        emit OrderCreated(orderCount, _productId, msg.sender);
    }

    // --- E. 确认收货 (仅释放资金，等待评价) ---
    function confirmReceipt(uint _orderId) public {
        Order storage o = orders[_orderId];
        Product storage p = products[o.productId]; 

        require(msg.sender == o.buyer, "Only buyer");
        require(o.state == OrderState.Locked, "Not locked");

        o.state = OrderState.Released; // 状态变为 Released (待评价)
        
        // 转账给卖家
        p.seller.transfer(o.price);
        
        // 注意：这里暂时不加分，改为在评价时加分（或者你也可以这里加1分，好评再加1分）
        sellers[p.seller].reputationScore += 1;

        emit OrderConfirmed(_orderId, msg.sender);
    }

    // --- F. 评价订单 (新增功能) ---
    function rateOrder(uint _orderId, uint _rating, string memory _comment) public {
        Order storage o = orders[_orderId];
        Product storage p = products[o.productId];

        require(msg.sender == o.buyer, "Only buyer");
        require(o.state == OrderState.Released, "Order not confirmed/released yet");
        require(_rating >= 1 && _rating <= 5, "Rating must be 1-5");

        o.state = OrderState.Completed; // 订单最终完成
        o.rating = _rating;
        o.comment = _comment;

        // 简单的动态信誉逻辑：
        if (_rating == 5) {
            sellers[p.seller].reputationScore += 2; // 好评额外+2
        } else if (_rating == 1) {
            sellers[p.seller].reputationScore -= 2; // 差评扣2
        }

        emit OrderRated(_orderId, _rating, _comment);
    }

    // --- G. 发起投诉 ---
    function raiseComplaint(uint _orderId, string memory _reason) public {
        Order storage o = orders[_orderId];
        require(msg.sender == o.buyer, "Only buyer");
        // 只有 Locked (未收货) 状态可以投诉
        require(o.state == OrderState.Locked, "Cannot complain");

        o.state = OrderState.Disputed;
        o.complaintReason = _reason;

        emit ComplaintRaised(_orderId, msg.sender, _reason);
    }

    // --- H. 监管裁决 (含黑名单逻辑) ---
    function resolveComplaint(uint _orderId, bool _buyerWon, string memory _details) public {
        Order storage o = orders[_orderId];
        Product storage p = products[o.productId];
        
        require(o.state == OrderState.Disputed, "Not disputed");

        if (_buyerWon) {
            // 买家赢：退款 + 扣分
            o.state = OrderState.Refunded;
            o.buyer.transfer(o.price); 
            
            // 严厉惩罚
            sellers[p.seller].reputationScore -= 20; 

            // ===> 自动冻结机制 <===
            // 如果信誉分低于 0，拉入黑名单，冻结所有交易权限
            if (sellers[p.seller].reputationScore < 0) {
                sellers[p.seller].isBlacklisted = true;
                emit SellerBlacklisted(p.seller, "Reputation too low");
            }

        } else {
            // 卖家赢：放款
            o.state = OrderState.Released;
            p.seller.transfer(o.price); 
        }
        emit ComplaintResolved(_orderId, _buyerWon);
    }
}