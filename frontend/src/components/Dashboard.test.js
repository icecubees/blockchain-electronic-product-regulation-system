import { render, screen } from "@testing-library/react";

import Dashboard from "./Dashboard";

jest.mock("recharts", () => {
  const React = require("react");
  const Mock = ({ children }) => <div>{children}</div>;

  return {
    ResponsiveContainer: Mock,
    PieChart: Mock,
    Pie: Mock,
    Cell: Mock,
    Tooltip: Mock,
    Legend: Mock,
    BarChart: Mock,
    Bar: Mock,
    XAxis: Mock,
    YAxis: Mock,
    CartesianGrid: Mock,
  };
});

test("renders live summary stats and audit log details", () => {
  render(
    <Dashboard
      products={[{ id: 1 }]}
      pendingProducts={[{ id: 2 }]}
      complaints={[{ id: 3, status: 3 }]}
      stats={{
        summary: {
          activeProducts: 6,
          pendingProducts: 2,
          openComplaints: 1,
          blacklistedSellers: 4,
          shippingOrders: 3,
          recalledProducts: 2,
          usedOrRefurbishedActiveProducts: 5,
          productsMissingCcc: 1,
          batteryComplaintCount: 2,
          riskySellersCount: 3,
          productsWithHighRiskTags: 4,
        },
        trends: [{ label: "04-10", audits: 2, shipments: 1, disputes: 0, riskFlags: 0, recalls: 1, reviewBlocks: 1 }],
        complaintTypeBreakdown: [
          { complaintType: "battery_issue", count: 2 },
          { complaintType: "performance_issue", count: 1 },
        ],
      }}
      auditLogs={[
        {
          id: 101,
          action: "ORDER_SHIPPED",
          targetType: "ORDER",
          targetId: 33,
          result: "SUCCESS",
          operatorUsername: "regulator_demo",
          details: JSON.stringify({
            trackingNumber: "SF123456789",
            shippingCarrier: "SF Express",
          }),
          createdAt: "2026-04-14T10:00:00.000Z",
        },
      ]}
    />
  );

  expect(screen.getByText("黑名单卖家").parentElement).toHaveTextContent("4");
  expect(screen.getByText("待审商品").parentElement).toHaveTextContent("2");
  expect(screen.getByText("已召回商品").parentElement).toHaveTextContent("2");
  expect(screen.getByText("电池相关投诉").parentElement).toHaveTextContent("2");
  expect(screen.getByText("投诉类型分布")).toBeInTheDocument();
  expect(screen.getByText("regulator_demo")).toBeInTheDocument();
  expect(screen.getByText(/SF123456789/)).toBeInTheDocument();
  expect(screen.getAllByRole("button").length).toBeGreaterThan(1);
});
