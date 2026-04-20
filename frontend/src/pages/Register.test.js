import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import Register from "./Register";
import AuthService from "../services/auth.service";
import FileService from "../services/file.service";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ children, to }) => <a href={to}>{children}</a>,
  }),
  { virtual: true }
);

jest.mock("../services/auth.service", () => ({
  register: jest.fn(),
}));

jest.mock("../services/file.service", () => ({
  uploadPublicSellerQualification: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  AuthService.register.mockResolvedValue({ data: { message: "ok" } });
  FileService.uploadPublicSellerQualification.mockResolvedValue({ data: { ipfsHash: "QmUploadedHash" } });
});

test("submits seller qualification metadata during seller registration", async () => {
  render(<Register />);

  fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "seller_01" } });
  fireEvent.change(screen.getByLabelText("密码"), { target: { value: "Passw0rd!" } });
  fireEvent.change(screen.getByLabelText("账号角色"), { target: { value: "seller" } });
  fireEvent.change(screen.getByLabelText("资质类型"), {
    target: { value: "brand_authorized" },
  });
  fireEvent.change(screen.getByLabelText("品牌授权材料哈希"), {
    target: { value: "QmBrandAuth" },
  });
  fireEvent.change(screen.getByLabelText("维修资质材料哈希"), {
    target: { value: "QmRepair" },
  });
  fireEvent.change(screen.getByLabelText("二手设备经营材料哈希"), {
    target: { value: "QmUsedDevice" },
  });
  fireEvent.change(screen.getByLabelText("资质说明"), {
    target: { value: "Authorized for electronics sales and repair." },
  });

  fireEvent.click(screen.getByRole("button", { name: "提交注册" }));

  await waitFor(() => {
    expect(AuthService.register).toHaveBeenCalled();
  });

  expect(AuthService.register).toHaveBeenCalledWith("seller_01", "Passw0rd!", "seller", {
    qualificationType: "brand_authorized",
    brandAuthorizationHash: "QmBrandAuth",
    repairQualificationHash: "QmRepair",
    usedDeviceQualificationHash: "QmUsedDevice",
    qualificationNotes: "Authorized for electronics sales and repair.",
  });
});

test("uploads seller qualification file and fills IPFS hash automatically", async () => {
  render(<Register />);

  fireEvent.change(screen.getByLabelText("账号角色"), { target: { value: "seller" } });
  const fileInputs = document.querySelectorAll('input[type="file"]');
  fireEvent.change(fileInputs[0], {
    target: { files: [new File(["demo"], "brand-auth.pdf", { type: "application/pdf" })] },
  });

  await waitFor(() => {
    expect(FileService.uploadPublicSellerQualification).toHaveBeenCalled();
  });

  expect(FileService.uploadPublicSellerQualification.mock.calls[0][1]).toBe("brandAuthorizationHash");
  await waitFor(() => {
    expect(screen.getByLabelText("品牌授权材料哈希")).toHaveValue("QmUploadedHash");
  });
});
