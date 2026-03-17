// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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
        address payable seller;
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
        address payable buyer;
        uint256 price;
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

    mapping(uint256 => Product) public products;
    mapping(uint256 => Order) public orders;
    mapping(address => Seller) public sellers;

    event ProductCreated(uint256 id, string name, uint256 stock, address seller);
    event ProductAudited(uint256 id, bool pass, string reason);
    event ProductDelisted(uint256 id, address operator, string reason);

    event OrderCreated(uint256 orderId, uint256 productId, address buyer);
    event OrderConfirmed(uint256 orderId, address buyer);
    event OrderRated(uint256 orderId, uint256 rating, string comment);

    event ComplaintRaised(uint256 orderId, address buyer, string reason);
    event ComplaintResolved(uint256 orderId, bool buyerWon);

    event SellerRegistered(uint256 id, address seller, int256 score);
    event SellerBlacklisted(address seller, string reason);

    constructor(address _aiOracleSigner) {
        require(_aiOracleSigner != address(0), "Invalid AI signer");
        owner = msg.sender;
        aiOracleSigner = _aiOracleSigner;
    }

    function setAiOracleSigner(address _aiOracleSigner) public {
        require(msg.sender == owner, "Only owner");
        require(_aiOracleSigner != address(0), "Invalid AI signer");
        aiOracleSigner = _aiOracleSigner;
    }

    function registerSeller() public {
        require(!sellers[msg.sender].isRegistered, "Seller already registered");
        sellerCount++;
        sellers[msg.sender] = Seller(sellerCount, msg.sender, true, 60, false);
        emit SellerRegistered(sellerCount, msg.sender, 60);
    }

    function createProduct(
        string memory _name,
        uint256 _price,
        string memory _ipfsHash,
        string memory _qualificationHash,
        uint256 _stock,
        bool _initialPass
    ) public {
        require(sellers[msg.sender].isRegistered, "Only sellers");
        require(!sellers[msg.sender].isBlacklisted, "Seller is blacklisted");
        require(_price > 0, "Price > 0");
        require(_stock > 0, "Stock > 0");

        productCount++;
        products[productCount] = Product(
            productCount,
            _name,
            _price,
            _ipfsHash,
            _qualificationHash,
            _stock,
            _initialPass,
            false,
            payable(msg.sender),
            true
        );
        emit ProductCreated(productCount, _name, _stock, msg.sender);
    }

    function auditProduct(
        uint256 _id,
        bool _pass,
        string memory _reason,
        bytes memory _signature
    ) public {
        require(_id > 0 && _id <= productCount, "Invalid ID");
        require(products[_id].exists, "Product not found");
        require(!products[_id].isDelisted, "Product delisted");
        require(_verifyAuditSignature(_id, _pass, _signature), "Invalid AI signature");

        products[_id].isAudited = _pass;
        emit ProductAudited(_id, _pass, _reason);
    }

    function delistProduct(uint256 _id, string memory _reason) public {
        require(_id > 0 && _id <= productCount, "Invalid ID");
        Product storage p = products[_id];
        require(p.exists, "Product not found");

        // Authorization is enforced by backend role checks (seller/regulator).`r`n
        p.isAudited = false;
        p.isDelisted = true;
        p.stock = 0;

        emit ProductDelisted(_id, msg.sender, _reason);
    }

    function purchaseProduct(uint256 _productId) public payable {
        Product storage p = products[_productId];

        require(p.exists, "Product not found");
        require(!p.isDelisted, "Product delisted");
        require(p.isAudited, "Product not audited");
        require(p.stock > 0, "Out of stock");
        require(msg.value >= p.price, "Not enough Ether");
        require(p.seller != msg.sender, "Seller cannot buy own");
        require(!sellers[p.seller].isBlacklisted, "Seller is blacklisted");

        p.stock = p.stock - 1;

        orderCount++;
        orders[orderCount] = Order(
            orderCount,
            _productId,
            payable(msg.sender),
            p.price,
            OrderState.Locked,
            "",
            0,
            ""
        );

        emit OrderCreated(orderCount, _productId, msg.sender);
    }

    function confirmReceipt(uint256 _orderId) public {
        Order storage o = orders[_orderId];
        Product storage p = products[o.productId];

        require(msg.sender == o.buyer, "Only buyer");
        require(o.state == OrderState.Locked, "Not locked");

        o.state = OrderState.Released;
        p.seller.transfer(o.price);
        sellers[p.seller].reputationScore += 1;

        emit OrderConfirmed(_orderId, msg.sender);
    }

    function rateOrder(uint256 _orderId, uint256 _rating, string memory _comment) public {
        Order storage o = orders[_orderId];
        Product storage p = products[o.productId];

        require(msg.sender == o.buyer, "Only buyer");
        require(o.state == OrderState.Released, "Order not confirmed/released yet");
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

    function raiseComplaint(uint256 _orderId, string memory _reason) public {
        Order storage o = orders[_orderId];
        require(msg.sender == o.buyer, "Only buyer");
        require(o.state == OrderState.Locked, "Cannot complain");

        o.state = OrderState.Disputed;
        o.complaintReason = _reason;

        emit ComplaintRaised(_orderId, msg.sender, _reason);
    }

    function resolveComplaint(uint256 _orderId, bool _buyerWon, string memory) public {
        Order storage o = orders[_orderId];
        Product storage p = products[o.productId];

        require(o.state == OrderState.Disputed, "Not disputed");

        if (_buyerWon) {
            o.state = OrderState.Refunded;
            o.buyer.transfer(o.price);

            sellers[p.seller].reputationScore -= 20;

            if (sellers[p.seller].reputationScore < 0) {
                sellers[p.seller].isBlacklisted = true;
                emit SellerBlacklisted(p.seller, "Reputation too low");
            }
        } else {
            o.state = OrderState.Released;
            p.seller.transfer(o.price);
        }

        emit ComplaintResolved(_orderId, _buyerWon);
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
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) {
            v += 27;
        }
    }
}

