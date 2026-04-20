import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import AddProduct from "./AddProduct";
import ProductService from "../services/product.service";
import FileService from "../services/file.service";
import AuthService from "../services/auth.service";

const mockNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
);

jest.mock("../services/product.service", () => ({
  addProduct: jest.fn(),
}));

jest.mock("../services/file.service", () => ({
  uploadProductReport: jest.fn(),
  uploadProductCertificate: jest.fn(),
}));

jest.mock("../services/auth.service", () => ({
  getCurrentUser: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  AuthService.getCurrentUser.mockReturnValue({
    id: 3,
    role: "seller",
    accessToken: "token",
  });
  FileService.uploadProductReport.mockResolvedValue({ data: { ipfsHash: "QmReport" } });
  FileService.uploadProductCertificate.mockResolvedValue({ data: { ipfsHash: "QmCert" } });
  ProductService.addProduct.mockResolvedValue({ data: { message: "ok" } });
});

test("submits electronic product fields together with existing publish flow", async () => {
  render(<AddProduct />);

  fireEvent.change(screen.getByLabelText("商品名称"), { target: { value: "Phone X" } });
  fireEvent.change(screen.getByLabelText("品牌"), { target: { value: "OpenAI Devices" } });
  fireEvent.change(screen.getByLabelText("型号"), { target: { value: "PX-1" } });
  fireEvent.change(screen.getByLabelText("序列号 / IMEI"), {
    target: { value: "SN-000123" },
  });
  fireEvent.change(screen.getByLabelText("CCC 编号"), { target: { value: "CCC-001" } });
  fireEvent.change(screen.getByLabelText("价格（ETH）"), { target: { value: "1.25" } });
  fireEvent.change(screen.getByLabelText("商品描述"), {
    target: { value: "A flagship electronic product." },
  });

  const files = [
    new File(["report"], "report.pdf", { type: "application/pdf" }),
    new File(["cert"], "cert.pdf", { type: "application/pdf" }),
  ];
  const fileInputs = document.querySelectorAll('input[type="file"]');
  fireEvent.change(fileInputs[0], { target: { files: [files[0]] } });
  fireEvent.change(fileInputs[1], { target: { files: [files[1]] } });

  fireEvent.click(screen.getByRole("button", { name: "提交审核" }));

  await waitFor(() => {
    expect(ProductService.addProduct).toHaveBeenCalled();
  });

  const [payload] = ProductService.addProduct.mock.calls[0];
  expect(payload.brand).toBe("OpenAI Devices");
  expect(payload.model).toBe("PX-1");
  expect(payload.serialNumber).toBe("SN-000123");
  expect(payload.cccNumber).toBe("CCC-001");
  expect(payload.ipfsHash).toBe("QmReport");
  expect(payload.qualificationHash).toBe("QmCert");
});
