import { fireEvent, render, screen } from "@testing-library/react";

import RegulatorReviewQueues from "./RegulatorReviewQueues";

test("shows missing review items and submits structured reason codes", () => {
  const onProductReview = jest.fn().mockResolvedValue(undefined);
  const onRecall = jest.fn().mockResolvedValue(undefined);

  render(
    <RegulatorReviewQueues
      pendingSellers={[]}
      pendingProducts={[
        {
          id: 8,
          name: "Phone X",
          description: "Flagship phone",
          seller: { username: "seller_a" },
          price: "1.25",
          stock: 4,
          category: "mobile_phone",
          brand: "OpenAI Devices",
          model: "PX-1",
          serialNumber: "",
          cccNumber: "",
          isUsed: false,
          isRefurbished: false,
          inspectionAgency: "QA Lab",
          inspectionConclusion: "pass",
          batterySafetyPassed: true,
          chargerSafetyPassed: true,
          appearanceGrade: "A",
          repairHistoryDeclared: false,
          missingReviewItems: ["Serial number or IMEI is required for mobile phones and tablets"],
          batchNo: "B-1",
        },
      ]}
      loading={false}
      onSellerReview={jest.fn()}
      onProductReview={onProductReview}
      onForceDelist={jest.fn()}
      onRecall={onRecall}
    />
  );

  expect(screen.getByText("缺失审核项")).toBeInTheDocument();
  expect(screen.getByText(/Serial number or IMEI/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "缺少设备唯一标识" }));
  fireEvent.click(screen.getByRole("button", { name: "审核通过" }));

  expect(onProductReview).toHaveBeenCalledWith(
    8,
    1,
    "电子产品审核通过，允许上架。",
    ["missing_device_identifier"]
  );

  fireEvent.change(screen.getByPlaceholderText("召回原因"), {
    target: { value: "Safety recall" },
  });
  fireEvent.change(screen.getByPlaceholderText("召回批次"), {
    target: { value: "B-2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "执行召回" }));

  expect(onRecall).toHaveBeenCalledWith(8, "Safety recall", "B-2");
});
