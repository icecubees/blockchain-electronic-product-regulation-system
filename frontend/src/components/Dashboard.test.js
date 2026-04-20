import { fireEvent, render, screen } from "@testing-library/react";

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
        trends: [
          {
            label: "04-10",
            audits: 2,
            shipments: 1,
            disputes: 0,
            riskFlags: 0,
            recalls: 1,
            reviewBlocks: 1,
          },
        ],
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
  expect(screen.getByText("审计日志中心")).toBeInTheDocument();
});

test("supports audit log filters, reset, and pagination callbacks", () => {
  const onAuditLogFilterChange = jest.fn();
  const onAuditLogSearch = jest.fn();
  const onAuditLogReset = jest.fn();
  const onAuditLogPageChange = jest.fn();

  render(
    <Dashboard
      auditLogs={[]}
      auditLogFilters={{
        keyword: "",
        action: "",
        result: "",
        targetType: "",
        targetId: "",
        operatorKeyword: "",
        dateFrom: "",
        dateTo: "",
        page: 1,
        pageSize: 10,
      }}
      appliedAuditLogFilters={{
        keyword: "refund",
        action: "ORDER_REFUND_COMPLETED",
        result: "SUCCESS",
        targetType: "ORDER",
        targetId: "33",
        operatorKeyword: "regulator_demo",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-15",
        page: 1,
        pageSize: 10,
      }}
      auditLogPagination={{ page: 1, pageSize: 10, total: 25, totalPages: 3 }}
      onAuditLogFilterChange={onAuditLogFilterChange}
      onAuditLogSearch={onAuditLogSearch}
      onAuditLogReset={onAuditLogReset}
      onAuditLogPageChange={onAuditLogPageChange}
    />
  );

  fireEvent.change(screen.getByPlaceholderText("关键词 / 详情 / 哈希"), {
    target: { value: "battery" },
  });
  fireEvent.change(screen.getByPlaceholderText("操作人 / 角色"), {
    target: { value: "admin" },
  });
  fireEvent.click(screen.getByRole("button", { name: "查询日志" }));
  fireEvent.click(screen.getByRole("button", { name: "重置条件" }));
  fireEvent.click(screen.getByRole("button", { name: "下一页" }));

  expect(onAuditLogFilterChange).toHaveBeenCalledWith("keyword", "battery");
  expect(onAuditLogFilterChange).toHaveBeenCalledWith("operatorKeyword", "admin");
  expect(onAuditLogSearch).toHaveBeenCalledWith({ page: 1 });
  expect(onAuditLogReset).toHaveBeenCalled();
  expect(onAuditLogPageChange).toHaveBeenCalledWith(2);
  expect(screen.getByText("关键词：refund")).toBeInTheDocument();
  expect(screen.getByText("动作：ORDER_REFUND_COMPLETED")).toBeInTheDocument();
});
