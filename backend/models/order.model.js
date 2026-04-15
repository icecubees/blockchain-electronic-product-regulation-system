module.exports = (sequelize, Sequelize) => {
  const Order = sequelize.define("orders", {
    onChainId: { type: Sequelize.INTEGER },
    price: { type: Sequelize.FLOAT },
    status: { type: Sequelize.INTEGER },
    paymentStatus: { type: Sequelize.STRING, defaultValue: "pending" },
    paymentMethod: { type: Sequelize.STRING },
    paymentReference: { type: Sequelize.STRING },
    paidAt: { type: Sequelize.DATE },
    refundStatus: { type: Sequelize.STRING, defaultValue: "none" },
    refundAmount: { type: Sequelize.FLOAT, defaultValue: 0 },
    refundedAt: { type: Sequelize.DATE },
    shippingStatus: { type: Sequelize.STRING, defaultValue: "pending" },
    trackingNumber: { type: Sequelize.STRING },
    shippingCarrier: { type: Sequelize.STRING },
    shippedAt: { type: Sequelize.DATE },
    buyerConfirmedAt: { type: Sequelize.DATE },
    complaintType: { type: Sequelize.STRING },
    complaintReason: { type: Sequelize.STRING },
    evidenceIpfsHash: { type: Sequelize.STRING },
    sellerResponse: { type: Sequelize.TEXT("long") },
    sellerEvidenceIpfsHash: { type: Sequelize.STRING },
    sellerRespondedAt: { type: Sequelize.DATE },
    rating: { type: Sequelize.INTEGER, defaultValue: 0 },
    comment: { type: Sequelize.STRING },
    resolvedBy: { type: Sequelize.INTEGER },
    resolvedAt: { type: Sequelize.DATE },
    rulingForBuyer: { type: Sequelize.BOOLEAN },
    rulingDetails: { type: Sequelize.STRING },
  });

  return Order;
};
