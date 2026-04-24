// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ProductRegulation {
    struct Product {
        uint256 id;
        string name;
        uint256 price;
        string ipfsHash;
        string qualificationHash;
        uint256 stock;
        bool isAudited;
        bool isDelisted;
        address seller;
        string brand;
        string model;
        string category;
        string deviceIdHash;
        string cccNumberHash;
        uint8 riskLevel;
        bool recallFlag;
        bool exists;
    }

    enum OrderState {
        Locked,
        Released,
        Completed,
        Disputed,
        Refunded
    }

    struct Order {
        uint256 id;
        uint256 productId;
        address buyer;
        address seller;
        uint256 price;
        uint256 escrowAmount;
        bool fundsSettled;
        OrderState state;
        string complaintReason;
        uint256 rating;
        string comment;
    }

    struct Seller {
        uint256 id;
        address walletAddress;
        bool isRegistered;
        int256 reputationScore;
        bool isBlacklisted;
    }

    uint256 public productCount = 0;
    uint256 public orderCount = 0;
    uint256 public sellerCount = 0;

    address public owner;
    address public aiOracleSigner;
    address public regulatorOperator;
    address public marketOperator;

    mapping(uint256 => Product) public products;
    mapping(uint256 => Order) public orders;
    mapping(address => Seller) public sellers;

    event ProductCreated(uint256 id, string name, uint256 stock, address seller);
    event ProductAudited(uint256 id, bool pass, string reason);
    event ProductDelisted(uint256 id, address operator, string reason);
    event ProductRestocked(uint256 id, uint256 amount, uint256 latestStock);
    event ProductComplianceUpdated(
        uint256 indexed id,
        string category,
        string cccNumberHash,
        uint8 riskLevel
    );
    event ProductRecallFlagged(
        uint256 indexed id,
        string reason,
        string batchNo,
        uint8 riskLevel
    );
    event ProductRepairRecorded(
        uint256 indexed id,
        string componentName,
        string description
    );
    event ProductRefurbishDeclared(uint256 indexed id, uint8 riskLevel, string notes);

    event OrderCreated(uint256 orderId, uint256 productId, address buyer);
    event PaymentEscrowed(uint256 indexed orderId, address indexed buyer, uint256 amount);
    event OrderConfirmed(uint256 orderId, address buyer);
    event FundsReleased(uint256 indexed orderId, address indexed seller, uint256 amount);
    event FundsRefunded(uint256 indexed orderId, address indexed buyer, uint256 amount);
    event OrderRated(uint256 orderId, uint256 rating, string comment);

    event ComplaintRaised(uint256 orderId, address buyer, string reason);
    event ComplaintResolved(uint256 orderId, bool buyerWon);

    event SellerRegistered(uint256 id, address seller, int256 score);
    event SellerBlacklisted(address seller, string reason);
    event SellerRestored(address seller, int256 score, string reason);
    event RegulatorOperatorUpdated(address operator);
    event MarketOperatorUpdated(address operator);
    event AiOracleUpdated(address signer);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyRegulatorOperator() {
        require(msg.sender == regulatorOperator || msg.sender == owner, "Only regulator operator");
        _;
    }

    modifier onlyMarketOperator() {
        require(msg.sender == marketOperator || msg.sender == owner, "Only market operator");
        _;
    }

    modifier onlyPlatformOperator() {
        require(
            msg.sender == marketOperator || msg.sender == regulatorOperator || msg.sender == owner,
            "Only platform operator"
        );
        _;
    }

    constructor(
        address _aiOracleSigner,
        address _regulatorOperator,
        address _marketOperator
    ) {
        require(_aiOracleSigner != address(0), "Invalid AI signer");
        require(_regulatorOperator != address(0), "Invalid regulator operator");
        require(_marketOperator != address(0), "Invalid market operator");

        owner = msg.sender;
        aiOracleSigner = _aiOracleSigner;
        regulatorOperator = _regulatorOperator;
        marketOperator = _marketOperator;
    }

    function setAiOracleSigner(address _aiOracleSigner) public onlyOwner {
        require(_aiOracleSigner != address(0), "Invalid AI signer");
        aiOracleSigner = _aiOracleSigner;
        emit AiOracleUpdated(_aiOracleSigner);
    }

    function setRegulatorOperator(address _regulatorOperator) public onlyOwner {
        require(_regulatorOperator != address(0), "Invalid regulator operator");
        regulatorOperator = _regulatorOperator;
        emit RegulatorOperatorUpdated(_regulatorOperator);
    }

    function setMarketOperator(address _marketOperator) public onlyOwner {
        require(_marketOperator != address(0), "Invalid market operator");
        marketOperator = _marketOperator;
        emit MarketOperatorUpdated(_marketOperator);
    }

    function registerSeller(address sellerWallet) public onlyRegulatorOperator {
        require(sellerWallet != address(0), "Invalid seller");
        require(!sellers[sellerWallet].isRegistered, "Seller already registered");

        sellerCount++;
        sellers[sellerWallet] = Seller(sellerCount, sellerWallet, true, 60, false);
        emit SellerRegistered(sellerCount, sellerWallet, 60);
    }

    function restoreSeller(
        address sellerWallet,
        int256 restoredScore,
        string memory reason
    ) public onlyRegulatorOperator {
        require(sellerWallet != address(0), "Invalid seller");
        require(sellers[sellerWallet].isRegistered, "Seller not registered");
        require(sellers[sellerWallet].isBlacklisted, "Seller is not blacklisted");
        require(restoredScore >= 0, "Score must be >= 0");

        sellers[sellerWallet].isBlacklisted = false;
        sellers[sellerWallet].reputationScore = restoredScore;

        emit SellerRestored(sellerWallet, restoredScore, reason);
    }

    function createProduct(
        string memory _name,
        uint256 _price,
        string memory _ipfsHash,
        string memory _qualificationHash,
        uint256 _stock,
        address sellerWallet,
        string memory _brand,
        string memory _model,
        string memory _category,
        string memory _deviceIdHash,
        string memory _cccNumberHash,
        uint8 _riskLevel
    ) public onlyMarketOperator {
        require(sellers[sellerWallet].isRegistered, "Only registered sellers");
        require(!sellers[sellerWallet].isBlacklisted, "Seller is blacklisted");
        require(_price > 0, "Price > 0");
        require(_stock > 0, "Stock > 0");
        require(_riskLevel <= 2, "Risk level invalid");

        productCount++;
        Product storage p = products[productCount];
        p.id = productCount;
        p.name = _name;
        p.price = _price;
        p.ipfsHash = _ipfsHash;
        p.qualificationHash = _qualificationHash;
        p.stock = _stock;
        p.isAudited = false;
        p.isDelisted = false;
        p.seller = sellerWallet;
        p.brand = _brand;
        p.model = _model;
        p.category = _category;
        p.deviceIdHash = _deviceIdHash;
        p.cccNumberHash = _cccNumberHash;
        p.riskLevel = _riskLevel;
        p.recallFlag = false;
        p.exists = true;

        emit ProductCreated(productCount, _name, _stock, sellerWallet);
        emit ProductComplianceUpdated(productCount, _category, _cccNumberHash, _riskLevel);
    }

    function auditProduct(
        uint256 _id,
        bool _pass,
        string memory _reason,
        bytes memory _signature
    ) public onlyRegulatorOperator {
        require(_id > 0 && _id <= productCount, "Invalid ID");
        require(products[_id].exists, "Product not found");
        require(!products[_id].isDelisted, "Product delisted");
        require(_verifyAuditSignature(_id, _pass, _signature), "Invalid AI signature");

        products[_id].isAudited = _pass;
        emit ProductAudited(_id, _pass, _reason);
    }

    function updateProductCompliance(
        uint256 _id,
        string memory _category,
        string memory _cccNumberHash,
        uint8 _riskLevel
    ) public onlyRegulatorOperator {
        require(_id > 0 && _id <= productCount, "Invalid ID");
        require(products[_id].exists, "Product not found");
        require(_riskLevel <= 2, "Risk level invalid");

        Product storage p = products[_id];
        p.category = _category;
        p.cccNumberHash = _cccNumberHash;
        p.riskLevel = _riskLevel;

        emit ProductComplianceUpdated(_id, _category, _cccNumberHash, _riskLevel);
    }

    function delistProduct(uint256 _id, string memory _reason) public onlyPlatformOperator {
        require(_id > 0 && _id <= productCount, "Invalid ID");
        Product storage p = products[_id];
        require(p.exists, "Product not found");

        p.isAudited = false;
        p.isDelisted = true;
        p.stock = 0;

        emit ProductDelisted(_id, msg.sender, _reason);
    }

    function flagProductRecall(
        uint256 _id,
        string memory _reason,
        string memory _batchNo,
        uint8 _riskLevel
    ) public onlyRegulatorOperator {
        require(_id > 0 && _id <= productCount, "Invalid ID");
        require(_riskLevel <= 2, "Risk level invalid");

        Product storage p = products[_id];
        require(p.exists, "Product not found");

        p.isAudited = false;
        p.isDelisted = true;
        p.stock = 0;
        p.recallFlag = true;
        p.riskLevel = _riskLevel;

        emit ProductRecallFlagged(_id, _reason, _batchNo, _riskLevel);
        emit ProductDelisted(_id, msg.sender, _reason);
    }

    function recordProductRepair(
        uint256 _id,
        string memory _componentName,
        string memory _description
    ) public onlyPlatformOperator {
        require(_id > 0 && _id <= productCount, "Invalid ID");
        require(products[_id].exists, "Product not found");

        emit ProductRepairRecorded(_id, _componentName, _description);
    }

    function declareProductRefurbish(
        uint256 _id,
        uint8 _riskLevel,
        string memory _notes
    ) public onlyPlatformOperator {
        require(_id > 0 && _id <= productCount, "Invalid ID");
        require(products[_id].exists, "Product not found");
        require(_riskLevel <= 2, "Risk level invalid");

        Product storage p = products[_id];
        if (_riskLevel > p.riskLevel) {
            p.riskLevel = _riskLevel;
        }

        emit ProductRefurbishDeclared(_id, p.riskLevel, _notes);
    }

    function restockProduct(uint256 _id, uint256 _amount) public onlyMarketOperator {
        require(_id > 0 && _id <= productCount, "Invalid ID");
        require(_amount > 0, "Amount > 0");

        Product storage p = products[_id];
        require(p.exists, "Product not found");
        require(!p.isDelisted, "Product delisted");
        require(!p.recallFlag, "Product recalled");

        p.stock = p.stock + _amount;
        emit ProductRestocked(_id, _amount, p.stock);
    }

    function purchaseProductFromWallet(uint256 _productId) public payable {
        _purchaseProduct(_productId, msg.sender);
    }

    function purchaseProduct(
        uint256 _productId,
        address buyerWallet
    ) public payable onlyMarketOperator {
        _purchaseProduct(_productId, buyerWallet);
    }

    function _purchaseProduct(uint256 _productId, address buyerWallet) internal {
        Product storage p = products[_productId];

        require(buyerWallet != address(0), "Invalid buyer");
        require(p.exists, "Product not found");
        require(!p.isDelisted, "Product delisted");
        require(!p.recallFlag, "Product recalled");
        require(p.isAudited, "Product not audited");
        require(p.stock > 0, "Out of stock");
        require(p.seller != buyerWallet, "Seller cannot buy own");
        require(!sellers[p.seller].isBlacklisted, "Seller is blacklisted");
        require(msg.value == p.price, "Incorrect payment amount");

        p.stock = p.stock - 1;

        orderCount++;
        orders[orderCount] = Order(
            orderCount,
            _productId,
            buyerWallet,
            p.seller,
            p.price,
            msg.value,
            false,
            OrderState.Locked,
            "",
            0,
            ""
        );

        emit OrderCreated(orderCount, _productId, buyerWallet);
        emit PaymentEscrowed(orderCount, buyerWallet, msg.value);
    }

    function confirmReceiptFromWallet(uint256 _orderId) public {
        _confirmReceipt(_orderId, msg.sender);
    }

    function confirmReceipt(
        uint256 _orderId,
        address buyerWallet
    ) public onlyMarketOperator {
        _confirmReceipt(_orderId, buyerWallet);
    }

    function _confirmReceipt(uint256 _orderId, address buyerWallet) internal {
        Order storage o = orders[_orderId];
        Product storage p = products[o.productId];

        require(o.id != 0, "Order not found");
        require(o.buyer == buyerWallet, "Buyer mismatch");
        require(o.state == OrderState.Locked, "Not locked");

        o.state = OrderState.Released;
        sellers[p.seller].reputationScore += 1;
        _releaseFundsToSeller(o, p.seller);

        emit OrderConfirmed(_orderId, buyerWallet);
    }

    function rateOrder(
        uint256 _orderId,
        address buyerWallet,
        uint256 _rating,
        string memory _comment
    ) public onlyMarketOperator {
        Order storage o = orders[_orderId];
        Product storage p = products[o.productId];

        require(o.id != 0, "Order not found");
        require(o.buyer == buyerWallet, "Buyer mismatch");
        require(o.state == OrderState.Released, "Order not confirmed");
        require(_rating >= 1 && _rating <= 5, "Rating must be 1-5");

        o.state = OrderState.Completed;
        o.rating = _rating;
        o.comment = _comment;

        if (_rating == 5) {
            sellers[p.seller].reputationScore += 2;
        } else if (_rating == 1) {
            sellers[p.seller].reputationScore -= 2;
        }

        emit OrderRated(_orderId, _rating, _comment);
    }

    function raiseComplaint(
        uint256 _orderId,
        address buyerWallet,
        string memory _reason
    ) public onlyMarketOperator {
        Order storage o = orders[_orderId];

        require(o.id != 0, "Order not found");
        require(o.buyer == buyerWallet, "Buyer mismatch");
        require(o.state == OrderState.Locked, "Cannot complain");

        o.state = OrderState.Disputed;
        o.complaintReason = _reason;

        emit ComplaintRaised(_orderId, buyerWallet, _reason);
    }

    function resolveComplaint(
        uint256 _orderId,
        bool _buyerWon,
        string memory
    ) public onlyRegulatorOperator {
        Order storage o = orders[_orderId];
        Product storage p = products[o.productId];

        require(o.id != 0, "Order not found");
        require(o.state == OrderState.Disputed, "Not disputed");

        if (_buyerWon) {
            o.state = OrderState.Refunded;
            sellers[p.seller].reputationScore -= 20;
            _refundFundsToBuyer(o);

            if (sellers[p.seller].reputationScore < 0) {
                sellers[p.seller].isBlacklisted = true;
                emit SellerBlacklisted(p.seller, "Reputation too low");
            }
        } else {
            o.state = OrderState.Released;
            _releaseFundsToSeller(o, p.seller);
        }

        emit ComplaintResolved(_orderId, _buyerWon);
    }

    function _releaseFundsToSeller(Order storage order, address sellerWallet) internal {
        require(!order.fundsSettled, "Funds already settled");
        order.fundsSettled = true;

        (bool sent, ) = payable(sellerWallet).call{value: order.escrowAmount}("");
        require(sent, "Seller payout failed");

        emit FundsReleased(order.id, sellerWallet, order.escrowAmount);
    }

    function _refundFundsToBuyer(Order storage order) internal {
        require(!order.fundsSettled, "Funds already settled");
        order.fundsSettled = true;

        (bool sent, ) = payable(order.buyer).call{value: order.escrowAmount}("");
        require(sent, "Buyer refund failed");

        emit FundsRefunded(order.id, order.buyer, order.escrowAmount);
    }

    function _verifyAuditSignature(
        uint256 _id,
        bool _pass,
        bytes memory _signature
    ) internal view returns (bool) {
        bytes32 payloadHash = keccak256(abi.encodePacked(_id, _pass));
        bytes32 signedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash)
        );

        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(_signature);
        address recoveredSigner = ecrecover(signedHash, v, r, s);
        return recoveredSigner == aiOracleSigner;
    }

    function _splitSignature(
        bytes memory sig
    ) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Invalid signature length");
        assembly ("memory-safe") {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) {
            v += 27;
        }
    }
}
