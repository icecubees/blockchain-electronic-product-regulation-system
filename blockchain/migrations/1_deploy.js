const ProductRegulation = artifacts.require("ProductRegulation");

module.exports = function (deployer) {
  deployer.deploy(ProductRegulation);
};