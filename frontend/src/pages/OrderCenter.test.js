import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import OrderCenter from "./OrderCenter";
import ProductService from "../services/product.service";
import FileService from "../services/file.service";
import AuthService from "../services/auth.service";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../services/product.service", () => ({
  getMyOrders: jest.fn(),
  createAfterSalesRequest: jest.fn(),
  raiseComplaint: jest.fn(),
  respondToAfterSalesRequest: jest.fn(),
  recordAfterSales: jest.fn(),
  updateRecallNotificationStatus: jest.fn(),
}));

jest.mock("../services/file.service", () => ({
  uploadComplaintEvidence: jest.fn(),
  uploadAfterSalesEvidence: jest.fn(),
}));

jest.mock("../services/auth.service", () => ({
  getCurrentUser: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  window.alert = jest.fn();
  FileService.uploadComplaintEvidence.mockResolvedValue({ data: { ipfsHash: "QmComplaint" } });
  FileService.uploadAfterSalesEvidence.mockResolvedValue({ data: { ipfsHash: "QmAfterSales" } });
  ProductService.createAfterSalesRequest.mockResolvedValue({ data: { message: "ok" } });
  ProductService.raiseComplaint.mockResolvedValue({ data: { message: "ok" } });
  ProductService.respondToAfterSalesRequest.mockResolvedValue({ data: { message: "ok" } });
  ProductService.recordAfterSales.mockResolvedValue({ data: { message: "ok" } });
  ProductService.updateRecallNotificationStatus.mockResolvedValue({ data: { message: "ok" } });
});

test("buyer complaint flow submits structured complaint type", async () => {
  AuthService.getCurrentUser.mockReturnValue({ id: 10, role: "buyer" });
  ProductService.getMyOrders.mockResolvedValue({
    data: [
      {
        id: 1,
        product: { name: "Phone X", seller: { username: "seller_a" } },
        price: 1.2,
        createdAt: "2026-01-01T00:00:00.000Z",
        status: 0,
        shippingStatus: "shipped",
      },
    ],
  });

  render(<OrderCenter />);

  await waitFor(() => {
    expect(ProductService.getMyOrders).toHaveBeenCalled();
  });

  fireEvent.click(screen.getByRole("button", { name: "监管投诉" }));
  fireEvent.change(screen.getByLabelText("投诉类型"), {
    target: { value: "serial_number_mismatch" },
  });
  fireEvent.change(screen.getByLabelText(/投诉原因/i), {
    target: { value: "The serial number on the device does not match the listing." },
  });
  fireEvent.click(screen.getByRole("button", { name: "提交投诉" }));

  await waitFor(() => {
    expect(ProductService.raiseComplaint).toHaveBeenCalledWith(
      1,
      "The serial number on the device does not match the listing.",
      null,
      "serial_number_mismatch"
    );
  });

  expect(screen.queryByRole("option", { name: "性能问题" })).not.toBeInTheDocument();
});

test("buyer can submit an after-sales request", async () => {
  AuthService.getCurrentUser.mockReturnValue({ id: 10, role: "buyer" });
  ProductService.getMyOrders.mockResolvedValue({
    data: [
      {
        id: 11,
        product: { name: "Tablet Z", seller: { username: "seller_after_sales" } },
        price: 2.1,
        createdAt: "2026-01-01T00:00:00.000Z",
        status: 2,
        shippingStatus: "delivered",
        afterSalesRequests: [],
      },
    ],
  });

  render(<OrderCenter />);

  await waitFor(() => {
    expect(ProductService.getMyOrders).toHaveBeenCalled();
  });

  fireEvent.click(screen.getByRole("button", { name: "申请售后" }));
  fireEvent.change(screen.getByLabelText("售后诉求"), {
    target: { value: "quality_refund" },
  });
  fireEvent.change(screen.getByLabelText(/申请说明/i), {
    target: { value: "The screen flickers after two days of normal use." },
  });
  fireEvent.click(screen.getByRole("button", { name: "提交售后申请" }));

  await waitFor(() => {
    expect(ProductService.createAfterSalesRequest).toHaveBeenCalledWith({
      orderId: 11,
      type: "quality_refund",
      description: "The screen flickers after two days of normal use.",
      evidenceIpfsHash: null,
    });
  });
});

test("seller can submit after-sales service records", async () => {
  AuthService.getCurrentUser.mockReturnValue({ id: 9, role: "seller" });
  ProductService.getMyOrders.mockResolvedValue({
    data: [
      {
        id: 2,
        product: { name: "Laptop Pro" },
        buyer: { username: "buyer_a" },
        price: 2.5,
        createdAt: "2026-01-01T00:00:00.000Z",
        status: 2,
        shippingStatus: "delivered",
        afterSalesRecords: [],
      },
    ],
  });

  render(<OrderCenter />);

  await waitFor(() => {
    expect(ProductService.getMyOrders).toHaveBeenCalled();
  });

  fireEvent.change(screen.getByDisplayValue("保修申请"), {
    target: { value: "repair" },
  });
  fireEvent.change(screen.getByPlaceholderText("部件名称（可选）"), {
    target: { value: "Battery Pack" },
  });
  fireEvent.change(
    screen.getByPlaceholderText("描述保修、维修、更换或退款的处理情况。"),
    {
      target: { value: "Battery pack replaced after overheating inspection." },
    }
  );
  fireEvent.change(screen.getByPlaceholderText("处理结果"), {
    target: { value: "Battery replaced" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保存售后记录" }));

  await waitFor(() => {
    expect(ProductService.recordAfterSales).toHaveBeenCalledWith({
      orderId: 2,
      type: "repair",
      componentName: "Battery Pack",
      description: "Battery pack replaced after overheating inspection.",
      serviceResult: "Battery replaced",
      evidenceIpfsHash: null,
    });
  });
});

test("seller can respond to a buyer after-sales request", async () => {
  AuthService.getCurrentUser.mockReturnValue({ id: 9, role: "seller" });
  ProductService.getMyOrders.mockResolvedValue({
    data: [
      {
        id: 12,
        product: { name: "Camera Pro" },
        buyer: { username: "buyer_request" },
        price: 3.2,
        createdAt: "2026-01-01T00:00:00.000Z",
        status: 2,
        shippingStatus: "delivered",
        afterSalesRequests: [
          {
            id: 121,
            type: "repair",
            description: "Lens motor gets stuck intermittently.",
            status: "pending_seller",
            createdAt: "2026-01-02T00:00:00.000Z",
          },
        ],
        afterSalesRecords: [],
      },
    ],
  });

  render(<OrderCenter />);

  await waitFor(() => {
    expect(ProductService.getMyOrders).toHaveBeenCalled();
  });

  fireEvent.change(screen.getByPlaceholderText("说明维修方案、补偿方案或处理安排。"), {
    target: { value: "We will inspect and replace the lens motor this week." },
  });
  fireEvent.click(screen.getByRole("button", { name: "提交售后响应" }));

  await waitFor(() => {
    expect(ProductService.respondToAfterSalesRequest).toHaveBeenCalledWith(
      121,
      "We will inspect and replace the lens motor this week.",
      null
    );
  });
});

test("order center shows payment and refund states", async () => {
  AuthService.getCurrentUser.mockReturnValue({ id: 10, role: "buyer" });
  ProductService.getMyOrders.mockResolvedValue({
    data: [
      {
        id: 3,
        product: { name: "Phone Y", seller: { username: "seller_b" } },
        price: 1.8,
        createdAt: "2026-01-01T00:00:00.000Z",
        status: 4,
        shippingStatus: "delivered",
        paymentStatus: "refunded",
        paymentReference: "CHAIN_ORDER_12",
        paidAt: "2026-01-01T01:00:00.000Z",
        refundStatus: "refunded",
        refundAmount: 1.8,
        refundedAt: "2026-01-02T01:00:00.000Z",
      },
    ],
  });

  render(<OrderCenter />);

  await waitFor(() => {
    expect(ProductService.getMyOrders).toHaveBeenCalled();
  });

  expect(screen.getByText("Payment status")).toBeInTheDocument();
  expect(screen.getByText("Refunded")).toBeInTheDocument();
  expect(screen.getByText("CHAIN_ORDER_12")).toBeInTheDocument();
  expect(screen.getByText("Refund amount")).toBeInTheDocument();
  expect(screen.getByText("1.8 ETH")).toBeInTheDocument();
});

test("buyer can acknowledge a recall notification from order center", async () => {
  AuthService.getCurrentUser.mockReturnValue({ id: 10, role: "buyer" });
  ProductService.getMyOrders.mockResolvedValue({
    data: [
      {
        id: 4,
        product: {
          name: "Phone Recall",
          seller: { username: "seller_c" },
          recallReason: "Battery overheating risk",
        },
        price: 1.5,
        createdAt: "2026-01-01T00:00:00.000Z",
        status: 1,
        shippingStatus: "delivered",
        recallNotifications: [
          {
            id: 41,
            status: "pending",
            notifiedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      },
    ],
  });

  render(<OrderCenter />);

  await waitFor(() => {
    expect(ProductService.getMyOrders).toHaveBeenCalled();
  });

  expect(screen.getByText("Recall notice")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Acknowledge recall" }));

  await waitFor(() => {
    expect(ProductService.updateRecallNotificationStatus).toHaveBeenCalledWith(
      41,
      "acknowledged"
    );
  });
});
