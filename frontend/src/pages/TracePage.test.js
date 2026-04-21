import { render, screen, waitFor } from "@testing-library/react";

import TracePage from "./TracePage";
import ProductService from "../services/product.service";
import AuthService from "../services/auth.service";

jest.mock("../services/product.service", () => ({
  getProductTrace: jest.fn(),
}));

jest.mock("../services/auth.service", () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ children, to }) => <a href={to}>{children}</a>,
    useSearchParams: () => [new URLSearchParams("productId=18")],
  }),
  { virtual: true }
);

const traceResponse = {
  productId: 18,
  chainProductId: 1018,
  name: "Phone X",
  description: "Premium smart phone",
  category: "mobile_phone",
  brand: "OpenAI Devices",
  model: "PX-1",
  serialNumberMasked: "SN****0123",
  batchNo: "B-2026-01",
  manufactureDate: "2026-01-02T00:00:00.000Z",
  warrantyUntil: "2027-01-02T00:00:00.000Z",
  isUsed: true,
  isRefurbished: false,
  batteryHealth: 91,
  accessoryStatus: "full",
  cccNumber: "CCC-001",
  energyLevel: "Level 1",
  rohsStatus: "Compliant",
  compliance: {
    inspectionAgency: "QA Lab",
    inspectionDate: "2026-01-03T00:00:00.000Z",
    inspectionConclusion: "pass",
    batterySafetyPassed: true,
    chargerSafetyPassed: true,
    appearanceGrade: "A",
    functionalTestPassed: true,
    repairHistoryDeclared: false,
  },
  review: {
    reasonCodes: ["battery_safety_concern"],
  },
  recall: {
    recallStatus: true,
    recallReason: "Battery overheating risk",
    recallNoticeAt: "2026-01-06T00:00:00.000Z",
    recallBatchNo: "B-2026-01",
  },
  auditStatus: 1,
  auditReason: "Approved for sale",
  auditAt: "2026-01-05T00:00:00.000Z",
  reviewer: { username: "regulator1", role: "regulator" },
  price: "1.25",
  stock: 4,
  ipfsHash: "QmReport",
  qualificationHash: "QmCert",
  seller: { reputationScore: 88, isBlacklisted: false },
  riskProfile: {
    riskLevel: "high",
    riskTags: ["recalled_device", "reused_ccc_number"],
  },
  chain: { source: "contract", stock: 4, sellerWallet: "0xabc" },
  chainSummary: {
    brand: "OpenAI Devices",
    model: "PX-1",
    category: "mobile_phone",
    deviceIdHash: "0xdevicehash",
    cccNumberHash: "0xccchash",
    riskLevel: 2,
    recallFlag: true,
  },
  metrics: { orderCount: 2, complaintCount: 0 },
  orders: [
    {
      id: 501,
      buyer: { username: "buyer_demo" },
      complaintType: "battery_issue",
      complaintReason: "Battery heats up unexpectedly",
      createdAt: "2026-01-02T00:00:00.000Z",
      status: 3,
      price: "1.25",
      sellerResponse: "We will inspect this order",
      rulingDetails: "Refund required",
    },
  ],
  afterSalesRecords: [
    {
      id: 801,
      orderId: 501,
      type: "repair",
      componentName: "Battery Pack",
      description: "Battery pack replaced after regulator review.",
      serviceResult: "Repaired",
      createdAt: "2026-01-08T00:00:00.000Z",
      creator: { username: "seller_a", role: "seller" },
    },
  ],
  timeline: [
    {
      id: 1,
      entityType: "PRODUCT",
      action: "PRODUCT_COMPLIANCE_UPDATED",
      result: "SUCCESS",
      details: JSON.stringify({ category: "mobile_phone" }),
      createdAt: "2026-01-07T00:00:00.000Z",
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  ProductService.getProductTrace.mockResolvedValue({ data: traceResponse });
});

test("regulator sees full trace details", async () => {
  AuthService.getCurrentUser.mockReturnValue({
    id: 1,
    role: "regulator",
    username: "regulator_demo",
  });

  render(<TracePage />);

  await waitFor(() => {
    expect(ProductService.getProductTrace).toHaveBeenCalledWith("18");
  });

  expect(screen.getByText("电子设备追溯报告")).toBeInTheDocument();
  expect(screen.getByText("监管视图")).toBeInTheDocument();
  expect(await screen.findByText("监管与链上状态")).toBeInTheDocument();
  expect(screen.getByText("Approved for sale")).toBeInTheDocument();
  expect(screen.getByText("QA Lab")).toBeInTheDocument();
  expect(screen.getByText("regulator1")).toBeInTheDocument();
  expect(screen.getByText("0xdevicehash")).toBeInTheDocument();
  expect(screen.getByText("审计时间线")).toBeInTheDocument();
  expect(screen.getByText("Refund required")).toBeInTheDocument();
});

test("buyer only sees buyer-safe trace content", async () => {
  AuthService.getCurrentUser.mockReturnValue({
    id: 2,
    role: "buyer",
    username: "buyer_demo",
  });

  render(<TracePage />);

  expect(await screen.findByText("买家视图")).toBeInTheDocument();
  expect(screen.queryByText("监管与链上状态")).not.toBeInTheDocument();
  expect(screen.queryByText("审计时间线")).not.toBeInTheDocument();
  expect(screen.queryByText("关联订单")).not.toBeInTheDocument();
  expect(screen.queryByText("QA Lab")).not.toBeInTheDocument();
  expect(screen.queryByText("0xdevicehash")).not.toBeInTheDocument();
  expect(screen.queryByText("regulator1")).not.toBeInTheDocument();
  expect(await screen.findByText("售后记录")).toBeInTheDocument();
  expect(screen.getByText("Battery pack replaced after regulator review.")).toBeInTheDocument();
});

test("seller sees operational details but not regulator-only timeline", async () => {
  AuthService.getCurrentUser.mockReturnValue({
    id: 3,
    role: "seller",
    username: "seller_demo",
  });

  render(<TracePage />);

  expect(await screen.findByText("商家视图")).toBeInTheDocument();
  expect(await screen.findByText("关联订单")).toBeInTheDocument();
  expect(screen.getByText("QA Lab")).toBeInTheDocument();
  expect(screen.queryByText("监管与链上状态")).not.toBeInTheDocument();
  expect(screen.queryByText("审计时间线")).not.toBeInTheDocument();
  expect(screen.queryByText("0xdevicehash")).not.toBeInTheDocument();
  expect(screen.queryByText("Refund required")).not.toBeInTheDocument();
  expect(screen.getByText("We will inspect this order")).toBeInTheDocument();
});
