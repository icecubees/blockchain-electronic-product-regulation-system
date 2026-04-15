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
      await instance.purchaseProduct(1, buyer, { from: market });
      assert.fail("purchase should fail for recalled products");
    } catch (error) {
      assert.match(error.message, /Product recalled|Out of stock|Product delisted/);
    }
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
      await instance.purchaseProduct(index + 2, buyer, { from: market });
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
