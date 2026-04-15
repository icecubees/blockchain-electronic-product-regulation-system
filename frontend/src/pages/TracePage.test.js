import { render, screen, waitFor } from "@testing-library/react";

import TracePage from "./TracePage";
import ProductService from "../services/product.service";

jest.mock("../services/product.service", () => ({
  getProductTrace: jest.fn(),
}));

jest.mock("react-router-dom", () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  useSearchParams: () => [new URLSearchParams("productId=18")],
}), { virtual: true });

beforeEach(() => {
  jest.clearAllMocks();
});

test("renders electronic device trace details", async () => {
  ProductService.getProductTrace.mockResolvedValue({
    data: {
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
          complaintType: "battery_issue",
          complaintReason: "Battery heats up unexpectedly",
          createdAt: "2026-01-02T00:00:00.000Z",
          status: 3,
          price: "1.25",
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
    },
  });

  render(<TracePage />);

  await waitFor(() => {
    expect(ProductService.getProductTrace).toHaveBeenCalledWith("18");
  });

  expect(screen.getByText("电子设备追溯报告")).toBeInTheDocument();
  expect(await screen.findAllByText("OpenAI Devices")).toHaveLength(2);
  expect(screen.getAllByText("PX-1").length).toBeGreaterThan(0);
  expect(screen.getByText("SN****0123")).toBeInTheDocument();
  expect(screen.getByText("CCC-001")).toBeInTheDocument();
  expect(screen.getByText("QA Lab")).toBeInTheDocument();
  expect(screen.getByText("Approved for sale")).toBeInTheDocument();
  expect(screen.getByText("召回公告")).toBeInTheDocument();
  expect(screen.getByText(/原因：Battery overheating risk/)).toBeInTheDocument();
  expect(screen.getByText("电池安全风险")).toBeInTheDocument();
  expect(screen.getByText(/风险等级：high/i)).toBeInTheDocument();
  expect(screen.getByText("reused_ccc_number")).toBeInTheDocument();
  expect(screen.getByText("高")).toBeInTheDocument();
  expect(screen.getByText("售后记录")).toBeInTheDocument();
  expect(screen.getByText("Battery pack replaced after regulator review.")).toBeInTheDocument();
  expect(screen.getByText(/电池问题 \/ Battery heats up unexpectedly/)).toBeInTheDocument();
  expect(screen.getByText(/合规摘要更新/)).toBeInTheDocument();
});
