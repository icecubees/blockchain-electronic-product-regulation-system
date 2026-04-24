import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import MyProducts from "./MyProducts";
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
  getMyProducts: jest.fn(),
  resubmitProduct: jest.fn(),
  delistProduct: jest.fn(),
  restockProduct: jest.fn(),
}));

jest.mock("../services/file.service", () => ({
  uploadProductReport: jest.fn(),
  uploadProductCertificate: jest.fn(),
}));

jest.mock("../services/auth.service", () => ({
  getCurrentUser: jest.fn(),
  bindSellerWallet: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  window.alert = jest.fn();
  AuthService.getCurrentUser.mockReturnValue({
    id: 7,
    role: "seller",
    reputationScore: 60,
    isBlacklisted: false,
    ethAddress: "0x0000000000000000000000000000000000000007",
    walletBound: true,
  });
  ProductService.getMyProducts.mockResolvedValue({
    data: [
      {
        id: 77,
        auditStatus: 2,
        recallStatus: false,
        stock: 2,
        name: "Old Phone",
        description: "Old description",
        brand: "OpenAI Devices",
        model: "PX-1",
        category: "mobile_phone",
        serialNumber: "SN-OLD-001",
        batchNo: "BATCH-OLD",
        price: 1.11,
        ipfsHash: "QmOldReport",
        qualificationHash: "QmOldCert",
      },
    ],
  });
  FileService.uploadProductReport.mockResolvedValue({ data: { ipfsHash: "QmUploadedReport" } });
  FileService.uploadProductCertificate.mockResolvedValue({
    data: { ipfsHash: "QmUploadedQualification" },
  });
  ProductService.resubmitProduct.mockResolvedValue({ data: { message: "商品重新提交成功。" } });
});

test("seller can upload replacement files during product resubmission", async () => {
  render(<MyProducts />);

  await waitFor(() => {
    expect(ProductService.getMyProducts).toHaveBeenCalled();
  });

  fireEvent.click(screen.getByRole("button", { name: "编辑并重新提交" }));

  const reportFile = new File(["report"], "new-report.pdf", { type: "application/pdf" });
  const qualificationFile = new File(["qualification"], "new-qualification.pdf", {
    type: "application/pdf",
  });

  fireEvent.change(screen.getByLabelText("重新上传检测报告"), {
    target: { files: [reportFile] },
  });
  fireEvent.change(screen.getByLabelText("重新上传资质文件"), {
    target: { files: [qualificationFile] },
  });

  fireEvent.click(screen.getByRole("button", { name: "确认重新提交" }));

  await waitFor(() => {
    expect(FileService.uploadProductReport).toHaveBeenCalledWith(reportFile);
    expect(FileService.uploadProductCertificate).toHaveBeenCalledWith(qualificationFile);
    expect(ProductService.resubmitProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 77,
        ipfsHash: "QmUploadedReport",
        qualificationHash: "QmUploadedQualification",
      })
    );
  });
});
