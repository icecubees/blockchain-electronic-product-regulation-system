import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import Home from "./Home";
import ProductService from "../services/product.service";
import AuthService from "../services/auth.service";
import AuditLogService from "../services/audit-log.service";

const mockNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
);

jest.mock(
  "qrcode.react",
  () => ({
    QRCodeCanvas: () => <div>QR</div>,
  }),
  { virtual: true }
);

jest.mock("../services/product.service", () => ({
  getAllProducts: jest.fn(),
  getPendingProducts: jest.fn(),
  getAllComplaints: jest.fn(),
  recallProduct: jest.fn(),
  delistProduct: jest.fn(),
  purchaseProduct: jest.fn(),
  auditProduct: jest.fn(),
  resolveComplaint: jest.fn(),
}));

jest.mock("../services/auth.service", () => ({
  getCurrentUser: jest.fn(),
  getPendingSellers: jest.fn(),
  getBlacklistedSellers: jest.fn(),
  getUsers: jest.fn(),
  approveSeller: jest.fn(),
  updateUserStatus: jest.fn(),
  unblacklistSeller: jest.fn(),
  logout: jest.fn(),
}));

jest.mock("../services/audit-log.service", () => ({
  getAuditLogs: jest.fn(),
  getAuditStats: jest.fn(),
}));

jest.mock("../components/BlacklistSellerManager", () => () => <div>Blacklist manager</div>);
jest.mock("../components/Dashboard", () => () => <div>Dashboard</div>);
jest.mock("../components/RegulatorReviewQueues", () => () => <div>Review queues</div>);

beforeEach(() => {
  jest.clearAllMocks();
  window.alert = jest.fn();
  window.prompt = jest.fn();
  AuthService.getCurrentUser.mockReturnValue({
    id: 1,
    role: "regulator",
    username: "regulator_demo",
  });
  ProductService.getAllProducts.mockResolvedValue({
    data: {
      items: [
        {
          id: 101,
          name: "Phone X",
          price: 1.25,
          stock: 4,
          description: "Flagship device",
          brand: "OpenAI Devices",
          model: "PX-1",
          category: "mobile_phone",
          recallStatus: false,
          seller: { id: 8, username: "seller_a" },
        },
      ],
      pagination: { page: 1, pageSize: 8, total: 1, totalPages: 1 },
    },
  });
  ProductService.getPendingProducts.mockResolvedValue({ data: [] });
  ProductService.getAllComplaints.mockResolvedValue({ data: [] });
  ProductService.recallProduct.mockResolvedValue({ data: { message: "ok" } });
  ProductService.delistProduct.mockResolvedValue({ data: { message: "ok" } });
  AuthService.getPendingSellers.mockResolvedValue({ data: [] });
  AuthService.getBlacklistedSellers.mockResolvedValue({ data: [] });
  AuthService.getUsers.mockResolvedValue({
    data: {
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    },
  });
  AuditLogService.getAuditLogs.mockResolvedValue({ data: [] });
  AuditLogService.getAuditStats.mockResolvedValue({
    data: { summary: {}, trends: [], complaintTypeBreakdown: [] },
  });
});

test("regulator can freeze a manageable user from governance panel", async () => {
  AuthService.getUsers.mockResolvedValue({
    data: {
      items: [
        {
          id: 22,
          username: "buyer_demo",
          role: "buyer",
          status: 1,
          ethAddress: "0xabc",
          canManage: true,
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    },
  });
  window.prompt.mockReturnValue("Risky abusive behavior");

  render(<Home />);

  expect(await screen.findByText("Regulator Console")).toBeInTheDocument();
  expect(await screen.findByText(/buyer_demo/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "冻结" }));

  await waitFor(() => {
    expect(AuthService.updateUserStatus).toHaveBeenCalledWith(
      22,
      2,
      "Risky abusive behavior"
    );
  });
});

test("监管员可以通过受控弹窗召回商品", async () => {
  render(<Home />);

  expect(await screen.findByText("Phone X")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "召回" }));
  fireEvent.change(screen.getByLabelText("召回原因"), {
    target: { value: "Battery overheating risk" },
  });
  fireEvent.change(screen.getByLabelText("召回批次号"), {
    target: { value: "B-2026-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认召回" }));

  await waitFor(() => {
    expect(ProductService.recallProduct).toHaveBeenCalledWith(
      101,
      "Battery overheating risk",
      "B-2026-01"
    );
  });
});
