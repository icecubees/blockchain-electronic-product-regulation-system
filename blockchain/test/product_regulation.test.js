const ProductRegulation = artifacts.require("ProductRegulation");

function buildAuditSignature(aiOracle, productId, pass) {
  const payloadHash = web3.utils.soliditySha3(
    { type: "uint256", value: productId },
    { type: "bool", value: pass }
  );

  return aiOracle.sign(payloadHash).signature;
}

contract("ProductRegulation", (accounts) => {
  const owner = accounts[0];
  const regulator = accounts[1];
  const market = accounts[2];
  const seller = accounts[3];
  const buyer = accounts[4];
  let aiOracle;
  let instance;
  const productPrice = web3.utils.toBN(100);

  beforeEach(async () => {
    aiOracle = web3.eth.accounts.create();
    instance = await ProductRegulation.new(aiOracle.address, regulator, market, { from: owner });

    await instance.registerSeller(seller, { from: regulator });
    await instance.createProduct(
      "Phone",
      100,
      "QmReport",
      "QmCert",
      4,
      seller,
      "OpenAI Devices",
      "PX-1",
      "mobile_phone",
      web3.utils.soliditySha3("SN-001"),
      web3.utils.soliditySha3("CCC-001"),
      1,
      { from: market }
    );

    const signature = buildAuditSignature(aiOracle, 1, true);
    await instance.auditProduct(1, true, "approved", signature, { from: regulator });
  });

  it("stores electronics summary fields on chain", async () => {
    const product = await instance.products(1);

    assert.equal(product.brand, "OpenAI Devices");
    assert.equal(product.model, "PX-1");
    assert.equal(product.category, "mobile_phone");
    assert.equal(product.riskLevel.toString(), "1");
    assert.equal(product.recallFlag, false);
  });

  it("restocks product inventory and emits ProductRestocked", async () => {
    const tx = await instance.restockProduct(1, 3, { from: market });
    const product = await instance.products(1);

    assert.equal(product.stock.toString(), "7", "stock should increase on chain");
    assert.equal(tx.logs[0].event, "ProductRestocked");
    assert.equal(tx.logs[0].args.amount.toString(), "3");
    assert.equal(tx.logs[0].args.latestStock.toString(), "7");
  });

  it("updates compliance summary and emits ProductComplianceUpdated", async () => {
    const tx = await instance.updateProductCompliance(
      1,
      "laptop",
      web3.utils.soliditySha3("CCC-NEW"),
      2,
      { from: regulator }
    );
    const product = await instance.products(1);

    assert.equal(product.category, "laptop");
    assert.equal(product.riskLevel.toString(), "2");
    assert.equal(tx.logs[0].event, "ProductComplianceUpdated");
  });

  it("flags product recall and prevents future purchases", async () => {
    const tx = await instance.flagProductRecall(1, "battery issue", "B-2026-01", 2, {
      from: regulator,
    });
    const product = await instance.products(1);

    assert.equal(product.recallFlag, true);
    assert.equal(product.isDelisted, true);
    assert.equal(product.stock.toString(), "0");
    assert.equal(tx.logs[0].event, "ProductRecallFlagged");

    try {
      await instance.purchaseProduct(1, buyer, { from: market, value: productPrice });
      assert.fail("purchase should fail for recalled products");
    } catch (error) {
      assert.match(error.message, /Product recalled|Out of stock|Product delisted/);
    }
  });

  it("escrows exact ETH value when a buyer purchases from MetaMask", async () => {
    const tx = await instance.purchaseProductFromWallet(1, {
      from: buyer,
      value: productPrice,
    });
    const order = await instance.orders(1);
    const contractBalance = await web3.eth.getBalance(instance.address);

    assert.equal(contractBalance.toString(), productPrice.toString());
    assert.equal(order.buyer, buyer);
    assert.equal(order.seller, seller);
    assert.equal(order.price.toString(), productPrice.toString());
    assert.equal(order.escrowAmount.toString(), productPrice.toString());
    assert.equal(order.fundsSettled, false);
    assert.equal(order.state.toString(), "0");
    assert.equal(tx.logs[1].event, "PaymentEscrowed");
    assert.equal(tx.logs[1].args.amount.toString(), productPrice.toString());
  });

  it("releases escrowed ETH to the seller after receipt confirmation", async () => {
    await instance.purchaseProductFromWallet(1, {
      from: buyer,
      value: productPrice,
    });

    const sellerBalanceBefore = web3.utils.toBN(await web3.eth.getBalance(seller));
    const tx = await instance.confirmReceiptFromWallet(1, { from: buyer });
    const sellerBalanceAfter = web3.utils.toBN(await web3.eth.getBalance(seller));
    const order = await instance.orders(1);
    const contractBalance = await web3.eth.getBalance(instance.address);

    assert.equal(sellerBalanceAfter.sub(sellerBalanceBefore).toString(), productPrice.toString());
    assert.equal(contractBalance.toString(), "0");
    assert.equal(order.fundsSettled, true);
    assert.equal(order.state.toString(), "1");
    assert.equal(tx.logs[0].event, "FundsReleased");
  });

  it("refunds escrowed ETH to the buyer when regulator rules for buyer", async () => {
    await instance.purchaseProductFromWallet(1, {
      from: buyer,
      value: productPrice,
    });
    await instance.raiseComplaint(1, buyer, "battery issue", { from: market });

    const buyerBalanceAfterPurchase = web3.utils.toBN(await web3.eth.getBalance(buyer));
    const tx = await instance.resolveComplaint(1, true, "refund", { from: regulator });
    const buyerBalanceAfterRefund = web3.utils.toBN(await web3.eth.getBalance(buyer));
    const order = await instance.orders(1);
    const contractBalance = await web3.eth.getBalance(instance.address);

    assert.equal(
      buyerBalanceAfterRefund.sub(buyerBalanceAfterPurchase).toString(),
      productPrice.toString()
    );
    assert.equal(contractBalance.toString(), "0");
    assert.equal(order.fundsSettled, true);
    assert.equal(order.state.toString(), "4");
    assert.equal(tx.logs[0].event, "FundsRefunded");
  });

  it("releases escrowed ETH to the seller when regulator rules for seller", async () => {
    await instance.purchaseProductFromWallet(1, {
      from: buyer,
      value: productPrice,
    });
    await instance.raiseComplaint(1, buyer, "battery issue", { from: market });

    const sellerBalanceBefore = web3.utils.toBN(await web3.eth.getBalance(seller));
    const tx = await instance.resolveComplaint(1, false, "seller evidence accepted", {
      from: regulator,
    });
    const sellerBalanceAfter = web3.utils.toBN(await web3.eth.getBalance(seller));
    const order = await instance.orders(1);

    assert.equal(sellerBalanceAfter.sub(sellerBalanceBefore).toString(), productPrice.toString());
    assert.equal(order.fundsSettled, true);
    assert.equal(order.state.toString(), "1");
    assert.equal(tx.logs[0].event, "FundsReleased");
  });

  it("emits lifecycle events for refurbish and repair actions", async () => {
    const refurbishTx = await instance.declareProductRefurbish(1, 2, "refurbished main board", {
      from: market,
    });
    const repairTx = await instance.recordProductRepair(1, "battery", "battery replaced", {
      from: market,
    });

    assert.equal(refurbishTx.logs[0].event, "ProductRefurbishDeclared");
    assert.equal(repairTx.logs[0].event, "ProductRepairRecorded");
  });

  it("restores a blacklisted seller after regulator review", async () => {
    for (let index = 0; index < 4; index += 1) {
      await instance.createProduct(
        `Phone-${index + 2}`,
        100,
        "QmReport",
        "QmCert",
        1,
        seller,
        "OpenAI Devices",
        `PX-${index + 2}`,
        "mobile_phone",
        web3.utils.soliditySha3(`SN-${index + 2}`),
        web3.utils.soliditySha3(`CCC-${index + 2}`),
        1,
        { from: market }
      );
      const signature = buildAuditSignature(aiOracle, index + 2, true);
      await instance.auditProduct(index + 2, true, "approved", signature, { from: regulator });
      await instance.purchaseProduct(index + 2, buyer, { from: market, value: productPrice });
      await instance.raiseComplaint(index + 1, buyer, `issue-${index}`, { from: market });
      await instance.resolveComplaint(index + 1, true, "refund", { from: regulator });
    }

    let sellerProfile = await instance.sellers(seller);
    assert.equal(sellerProfile.isBlacklisted, true, "seller should be blacklisted");

    const restoreTx = await instance.restoreSeller(seller, 20, "manual review complete", {
      from: regulator,
    });

    sellerProfile = await instance.sellers(seller);
    assert.equal(sellerProfile.isBlacklisted, false, "seller should be restored");
    assert.equal(sellerProfile.reputationScore.toString(), "20");
    assert.equal(restoreTx.logs[0].event, "SellerRestored");
  });
});
