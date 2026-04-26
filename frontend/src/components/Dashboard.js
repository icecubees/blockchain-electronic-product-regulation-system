import React, { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";

const ACTION_LABELS = {
  LOGIN_SUCCESS: "登录成功",
  LOGIN_FAILED: "登录失败",
  SELLER_APPROVED: "卖家审核通过",
  SELLER_REJECTED: "卖家审核驳回",
  SELLER_BLACKLISTED: "卖家拉黑",
  SELLER_RESTORED: "卖家恢复",
  PRODUCT_CREATED: "商品提交审核",
  PRODUCT_AI_REJECTED: "AI 预审驳回",
  PRODUCT_AI_SKIPPED_BY_SETTING: "AI 审核跳过",
  PRODUCT_AI_DEGRADED_TO_MANUAL_REVIEW: "AI 降级人工审核",
  AI_AUDIT_SETTING_UPDATED: "AI 审核设置更新",
  PRODUCT_AUDITED: "商品审核完成",
  PRODUCT_REVIEW_BLOCKED: "审核拦截",
  PRODUCT_DELISTED: "商品下架",
  PRODUCT_RECALL_FLAGGED: "商品召回",
  PRODUCT_COMPLIANCE_UPDATED: "合规摘要更新",
  PRODUCT_REFURBISH_DECLARED: "翻新声明",
  PRODUCT_REPAIR_RECORDED: "维修记录上链",
  WARRANTY_UPDATED: "质保信息更新",
  PRODUCT_RESTOCKED: "商品补货",
  PRODUCT_RESUBMITTED: "商品重新提交",
  PRODUCT_PURCHASED: "商品成交",
  ORDER_SHIPPED: "订单发货",
  ORDER_CONFIRMED: "确认收货",
  ORDER_RATED: "订单评价",
  COMPLAINT_RAISED: "发起投诉",
  SELLER_RESPONSE_SUBMITTED: "卖家答辩提交",
  COMPLAINT_RESOLVED: "投诉裁决完成",
  FILE_UPLOADED: "文件上传",
  ACCESS_DENIED: "访问被拒绝",
  ORDER_REFUND_COMPLETED: "订单退款完成",
  AFTER_SALES_REQUEST_CREATED: "售后申请创建",
  AFTER_SALES_REQUEST_ESCALATED: "售后升级投诉",
};

const ACTION_COLORS = {
  LOGIN_SUCCESS: "text-emerald-400",
  LOGIN_FAILED: "text-rose-400",
  SELLER_APPROVED: "text-sky-400",
  SELLER_REJECTED: "text-orange-400",
  SELLER_BLACKLISTED: "text-rose-400",
  SELLER_RESTORED: "text-emerald-400",
  PRODUCT_CREATED: "text-cyan-400",
  PRODUCT_AI_REJECTED: "text-rose-400",
  PRODUCT_AI_SKIPPED_BY_SETTING: "text-slate-300",
  PRODUCT_AI_DEGRADED_TO_MANUAL_REVIEW: "text-amber-300",
  AI_AUDIT_SETTING_UPDATED: "text-cyan-400",
  PRODUCT_AUDITED: "text-green-400",
  PRODUCT_REVIEW_BLOCKED: "text-rose-400",
  PRODUCT_DELISTED: "text-orange-400",
  PRODUCT_RECALL_FLAGGED: "text-rose-400",
  PRODUCT_COMPLIANCE_UPDATED: "text-cyan-400",
  PRODUCT_REFURBISH_DECLARED: "text-violet-400",
  PRODUCT_REPAIR_RECORDED: "text-amber-300",
  WARRANTY_UPDATED: "text-sky-400",
  PRODUCT_RESTOCKED: "text-amber-400",
  PRODUCT_RESUBMITTED: "text-blue-400",
  PRODUCT_PURCHASED: "text-emerald-400",
  ORDER_SHIPPED: "text-indigo-400",
  ORDER_CONFIRMED: "text-sky-400",
  ORDER_RATED: "text-violet-400",
  COMPLAINT_RAISED: "text-rose-400",
  SELLER_RESPONSE_SUBMITTED: "text-amber-300",
  COMPLAINT_RESOLVED: "text-fuchsia-400",
  FILE_UPLOADED: "text-yellow-400",
  ACCESS_DENIED: "text-rose-400",
  ORDER_REFUND_COMPLETED: "text-emerald-400",
  AFTER_SALES_REQUEST_CREATED: "text-cyan-400",
  AFTER_SALES_REQUEST_ESCALATED: "text-amber-400",
};

const TARGET_LABELS = {
  USER: "用户",
  PRODUCT: "商品",
  ORDER: "订单",
  ROUTE: "接口",
  PRODUCT_REPORT: "检测报告",
  PRODUCT_CERTIFICATE: "资质材料",
  COMPLAINT_EVIDENCE: "买家证据",
  SELLER_COMPLAINT_EVIDENCE: "卖家证据",
  SYSTEM_SETTING: "系统设置",
};

const RESULT_STYLES = {
  SUCCESS: "border border-emerald-500/20 bg-emerald-500/15 text-emerald-300",
  FAIL: "border border-rose-500/20 bg-rose-500/15 text-rose-300",
};

const RESULT_LABELS = {
  SUCCESS: "成功",
  FAIL: "失败",
};

const CONTRACT_EVENT_LABELS = {
  SELLER_APPROVED: "SellerRegistered",
  SELLER_BLACKLISTED: "SellerBlacklisted",
  SELLER_RESTORED: "SellerRestored",
  PRODUCT_CREATED: "ProductCreated",
  PRODUCT_AUDITED: "ProductAudited",
  PRODUCT_DELISTED: "ProductDelisted",
  PRODUCT_RECALL_FLAGGED: "ProductRecallFlagged",
  PRODUCT_COMPLIANCE_UPDATED: "ProductComplianceUpdated",
  PRODUCT_REFURBISH_DECLARED: "ProductRefurbishDeclared",
  PRODUCT_REPAIR_RECORDED: "ProductRepairRecorded",
  WARRANTY_UPDATED: "WarrantyUpdated",
  PRODUCT_RESTOCKED: "ProductRestocked",
  PRODUCT_PURCHASED: "PaymentEscrowed",
  ORDER_SHIPPED: "OrderShipped",
  ORDER_CONFIRMED: "FundsReleased",
  ORDER_RATED: "OrderRated",
  COMPLAINT_RAISED: "ComplaintRaised",
  COMPLAINT_RESOLVED: "ComplaintResolved / FundsSettled",
  ORDER_REFUND_COMPLETED: "FundsRefunded",
};

const FILTER_OPTIONS = [
  { id: "all", label: "全部日志", actions: null },
  {
    id: "chain",
    label: "链上凭证",
    actions: [
      "SELLER_APPROVED",
      "SELLER_BLACKLISTED",
      "SELLER_RESTORED",
      "PRODUCT_CREATED",
      "PRODUCT_AUDITED",
      "PRODUCT_DELISTED",
      "PRODUCT_RECALL_FLAGGED",
      "PRODUCT_COMPLIANCE_UPDATED",
      "PRODUCT_REFURBISH_DECLARED",
      "PRODUCT_REPAIR_RECORDED",
      "WARRANTY_UPDATED",
      "PRODUCT_RESTOCKED",
      "PRODUCT_PURCHASED",
      "ORDER_SHIPPED",
      "ORDER_CONFIRMED",
      "ORDER_RATED",
      "COMPLAINT_RAISED",
      "COMPLAINT_RESOLVED",
      "ORDER_REFUND_COMPLETED",
    ],
  },
  {
    id: "product",
    label: "商品监管",
    actions: [
      "PRODUCT_CREATED",
      "PRODUCT_AUDITED",
      "PRODUCT_REVIEW_BLOCKED",
      "PRODUCT_DELISTED",
      "PRODUCT_RECALL_FLAGGED",
      "PRODUCT_COMPLIANCE_UPDATED",
      "PRODUCT_REFURBISH_DECLARED",
      "PRODUCT_REPAIR_RECORDED",
      "WARRANTY_UPDATED",
      "PRODUCT_RESUBMITTED",
      "PRODUCT_RESTOCKED",
    ],
  },
  {
    id: "order",
    label: "订单物流",
    actions: ["PRODUCT_PURCHASED", "ORDER_SHIPPED", "ORDER_CONFIRMED", "ORDER_RATED"],
  },
  {
    id: "complaint",
    label: "投诉处置",
    actions: [
      "COMPLAINT_RAISED",
      "SELLER_RESPONSE_SUBMITTED",
      "COMPLAINT_RESOLVED",
      "SELLER_BLACKLISTED",
      "SELLER_RESTORED",
      "AFTER_SALES_REQUEST_CREATED",
      "AFTER_SALES_REQUEST_ESCALATED",
    ],
  },
  {
    id: "security",
    label: "访问控制",
    actions: ["LOGIN_SUCCESS", "LOGIN_FAILED", "ACCESS_DENIED"],
  },
];

const DETAIL_KEY_LABELS = {
  auditStatus: "审核状态",
  oracleAddress: "预言机地址",
  reason: "原因",
  forced: "强制操作",
  chainOrderId: "链上订单编号",
  chainProductId: "链上商品编号",
  username: "用户名",
  evidenceIpfsHash: "证据 IPFS",
  complaintType: "投诉类型",
  rulingForBuyer: "买家胜诉",
  rulingDetails: "裁决说明",
  currentRole: "当前角色",
  requiredRoles: "要求角色",
  name: "商品名称",
  trackingNumber: "物流单号",
  shippingCarrier: "物流承运方",
  amount: "补货数量",
  newStock: "最新库存",
  orderId: "订单编号",
  type: "类型",
  componentName: "部件名称",
  serviceResult: "处理结果",
  afterSalesRequestId: "售后申请 ID",
};

const ROLE_LABELS = {
  buyer: "买家",
  seller: "卖家",
  regulator: "监督方",
};

const COMPLAINT_TYPE_LABELS = {
  battery_issue: "电池问题",
  counterfeit_suspected: "疑似假货",
  refurbished_not_disclosed: "翻新未披露",
  serial_number_mismatch: "序列号不一致",
  performance_issue: "性能问题",
  accessory_mismatch: "配件不符",
  safety_risk: "安全风险",
};

const AUDIT_STATUS_LABELS = {
  0: "待审核",
  1: "已通过",
  2: "已驳回或已下架",
};

const DEFAULT_AUDIT_LOG_FILTERS = {
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
};

const DEFAULT_AUDIT_LOG_PAGINATION = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1,
};

function formatDetailValue(key, value) {
  if (Array.isArray(value)) {
    return value.map((item) => formatDetailValue(key, item)).join(" / ");
  }

  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }

  if (key === "auditStatus") {
    return AUDIT_STATUS_LABELS[value] || String(value);
  }

  if (key === "complaintType") {
    return COMPLAINT_TYPE_LABELS[value] || String(value);
  }

  if (key === "currentRole") {
    return ROLE_LABELS[value] || String(value);
  }

  if (key === "requiredRoles") {
    return Array.isArray(value)
      ? value.map((item) => ROLE_LABELS[item] || item).join(" / ")
      : ROLE_LABELS[value] || String(value);
  }

  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  return value === null || value === undefined || value === "" ? "未提供" : String(value);
}

function isRealTxHash(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

function shortenHash(value) {
  if (!value || value === "未提供") {
    return "未提供";
  }

  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function getDetailItemValue(detailItems, keys) {
  const keySet = new Set(keys);
  const item = detailItems.find((detailItem) => keySet.has(detailItem.key));
  return item?.value || null;
}

export default function Dashboard({
  products = [],
  pendingProducts = [],
  complaints = [],
  auditLogs = [],
  stats,
  auditLogFilters = DEFAULT_AUDIT_LOG_FILTERS,
  appliedAuditLogFilters = DEFAULT_AUDIT_LOG_FILTERS,
  auditLogPagination = DEFAULT_AUDIT_LOG_PAGINATION,
  auditLogLoading = false,
  onAuditLogFilterChange,
  onAuditLogSearch,
  onAuditLogReset,
  onAuditLogPageChange,
}) {
  const [selectedFilter, setSelectedFilter] = useState("all");

  const summary = stats?.summary || {
    activeProducts: products.length || 0,
    pendingProducts: pendingProducts.length || 0,
    openComplaints: complaints.filter((item) => item.status === 3).length || 0,
    blacklistedSellers: 0,
    shippingOrders: 0,
    recalledProducts: 0,
    usedOrRefurbishedActiveProducts: 0,
    productsMissingCcc: 0,
    batteryComplaintCount: 0,
    riskySellersCount: 0,
    productsWithHighRiskTags: 0,
  };

  const pieData = [
    { name: "在售商品", value: summary.activeProducts || 0, color: "#10B981" },
    { name: "待审商品", value: summary.pendingProducts || 0, color: "#F59E0B" },
    { name: "处理中投诉", value: summary.openComplaints || 0, color: "#EF4444" },
    { name: "运输中订单", value: summary.shippingOrders || 0, color: "#6366F1" },
  ];

  const trendData = stats?.trends || [];
  const electronicsRiskData = [
    { label: "已召回", value: summary.recalledProducts || 0 },
    { label: "二手/翻新", value: summary.usedOrRefurbishedActiveProducts || 0 },
    { label: "缺少 CCC", value: summary.productsMissingCcc || 0 },
    { label: "电池投诉", value: summary.batteryComplaintCount || 0 },
    { label: "高风险卖家", value: summary.riskySellersCount || 0 },
    { label: "高风险商品", value: summary.productsWithHighRiskTags || 0 },
  ];
  const complaintTypeData = (stats?.complaintTypeBreakdown || []).map((item) => ({
    label: COMPLAINT_TYPE_LABELS[item.complaintType] || item.complaintType,
    count: item.count,
  }));

  const normalizedAuditLogs = useMemo(
    () =>
      auditLogs.map((log) => {
        let detailItems = [];

        if (log.details) {
          try {
            const parsed = typeof log.details === "string" ? JSON.parse(log.details) : log.details;
            detailItems = Object.entries(parsed).map(([key, value]) => ({
              key,
              label: DETAIL_KEY_LABELS[key] || key,
              value: formatDetailValue(key, value),
            }));
          } catch (error) {
            detailItems = [{ key: "details", label: "详情", value: String(log.details) }];
          }
        }

        return {
          id: log.id,
          action: log.action,
          timestamp: new Date(log.createdAt || Date.now()).getTime(),
          actionLabel: ACTION_LABELS[log.action] || log.action,
          color: ACTION_COLORS[log.action] || "text-slate-300",
          contractEvent: CONTRACT_EVENT_LABELS[log.action] || null,
          operator:
            log.operatorUsername ||
            (log.operatorRole ? `系统(${ROLE_LABELS[log.operatorRole] || log.operatorRole})` : "系统"),
          result: log.result || "SUCCESS",
          resultLabel: RESULT_LABELS[log.result] || log.result || "成功",
          target: `${TARGET_LABELS[log.targetType] || log.targetType || "目标"}${
            log.targetId ? ` #${log.targetId}` : ""
          }`,
          detailItems:
            detailItems.length > 0
              ? detailItems
              : [{ key: "details", label: "详情", value: "未提供" }],
          txHash: log.txHash || null,
          ipfsHash: log.ipfsHash || null,
          hash: log.txHash || log.ipfsHash || "未提供",
          hasChainCredential: Boolean(CONTRACT_EVENT_LABELS[log.action] && isRealTxHash(log.txHash)),
        };
      }),
    [auditLogs]
  );

  const visibleAuditLogs = useMemo(() => {
    const selected = FILTER_OPTIONS.find((item) => item.id === selectedFilter);
    if (!selected || !selected.actions) {
      return normalizedAuditLogs;
    }

    return normalizedAuditLogs.filter((item) => selected.actions.includes(item.action));
  }, [normalizedAuditLogs, selectedFilter]);

  const chainCredentialLogs = useMemo(
    () => normalizedAuditLogs.filter((log) => log.hasChainCredential).slice(0, 4),
    [normalizedAuditLogs]
  );

  const chainEvidenceTimeline = useMemo(
    () =>
      normalizedAuditLogs
        .filter((log) => log.contractEvent || log.txHash || log.ipfsHash)
        .slice(0, 6)
        .map((log) => ({
          ...log,
          orderId: getDetailItemValue(log.detailItems, ["orderId", "chainOrderId"]),
          productId: getDetailItemValue(log.detailItems, ["chainProductId", "productId"]),
          ruling: getDetailItemValue(log.detailItems, ["rulingForBuyer", "rulingDetails"]),
        })),
    [normalizedAuditLogs]
  );

  const appliedFilterSummary = useMemo(() => {
    const items = [];
    if (appliedAuditLogFilters.keyword) {
      items.push(`关键词：${appliedAuditLogFilters.keyword}`);
    }
    if (appliedAuditLogFilters.action) {
      items.push(`动作：${appliedAuditLogFilters.action}`);
    }
    if (appliedAuditLogFilters.result) {
      items.push(`结果：${appliedAuditLogFilters.result}`);
    }
    if (appliedAuditLogFilters.targetType) {
      items.push(`目标类型：${appliedAuditLogFilters.targetType}`);
    }
    if (appliedAuditLogFilters.targetId) {
      items.push(`目标 ID：${appliedAuditLogFilters.targetId}`);
    }
    if (appliedAuditLogFilters.operatorKeyword) {
      items.push(`操作人：${appliedAuditLogFilters.operatorKeyword}`);
    }
    if (appliedAuditLogFilters.dateFrom || appliedAuditLogFilters.dateTo) {
      items.push(
        `时间：${appliedAuditLogFilters.dateFrom || "不限"} 至 ${
          appliedAuditLogFilters.dateTo || "不限"
        }`
      );
    }

    return items;
  }, [appliedAuditLogFilters]);

  const exportAuditLogsCsv = () => {
    const headers = ["id", "timestamp", "action", "operator", "result", "target", "details", "hash"];
    const lines = [headers.join(",")];

    visibleAuditLogs.forEach((log) => {
      const detailsText = log.detailItems.map((item) => `${item.label}: ${item.value}`).join(" | ");
      const row = [
        log.id,
        new Date(log.timestamp).toISOString(),
        log.actionLabel,
        `"${String(log.operator).replace(/"/g, '""')}"`,
        log.result,
        `"${String(log.target).replace(/"/g, '""')}"`,
        `"${String(detailsText).replace(/"/g, '""')}"`,
        log.hash,
      ];
      lines.push(row.join(","));
    });

    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `audit-trace-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  };

  const handleAuditLogFieldChange = (key, value) => {
    if (typeof onAuditLogFilterChange === "function") {
      onAuditLogFilterChange(key, value);
    }
  };

  const handleAuditLogSearch = () => {
    if (typeof onAuditLogSearch === "function") {
      onAuditLogSearch({ page: 1 });
    }
  };

  const handleAuditLogReset = () => {
    if (typeof onAuditLogReset === "function") {
      onAuditLogReset();
    }
  };

  const handleAuditLogPageChange = (page) => {
    if (typeof onAuditLogPageChange === "function") {
      onAuditLogPageChange(page);
    }
  };

  return (
    <div className="mb-8 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50 p-6 shadow-inner">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">电子产品监管看板</h2>
          <p className="mt-1 text-sm text-slate-500">
            基于审计日志、订单状态、投诉记录与链上流程数据生成的实时监管视图。
          </p>
        </div>
        <div className="grid min-w-[280px] grid-cols-2 gap-3 md:grid-cols-5">
          <SummaryCard label="待审商品" value={summary.pendingProducts} accent="text-amber-600" />
          <SummaryCard label="处理中投诉" value={summary.openComplaints} accent="text-rose-600" />
          <SummaryCard label="黑名单卖家" value={summary.blacklistedSellers} accent="text-slate-900" />
          <SummaryCard label="运输中订单" value={summary.shippingOrders} accent="text-indigo-600" />
          <SummaryCard label="已召回商品" value={summary.recalledProducts} accent="text-rose-600" />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => {
          const active = option.id === selectedFilter;
          return (
            <button
              key={option.id}
              onClick={() => setSelectedFilter(option.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-slate-900 text-white shadow"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard
          label="在售二手/翻新商品"
          value={summary.usedOrRefurbishedActiveProducts}
          className="border-amber-100 bg-amber-50 text-amber-800"
        />
        <MetricCard
          label="缺少 CCC 的在售商品"
          value={summary.productsMissingCcc}
          className="border-cyan-100 bg-cyan-50 text-cyan-800"
        />
        <MetricCard
          label="电池相关投诉"
          value={summary.batteryComplaintCount}
          className="border-rose-100 bg-rose-50 text-rose-800"
        />
        <MetricCard
          label="高风险卖家"
          value={summary.riskySellersCount}
          className="border-slate-200 bg-slate-50 text-slate-800"
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-4">
        <ChartPanel title="实时结构概览">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={64}
              outerRadius={92}
              paddingAngle={4}
              dataKey="value"
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={32} />
          </PieChart>
        </ChartPanel>

        <ChartPanel title="近 7 日事件趋势">
          <BarChart data={trendData} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Legend verticalAlign="top" height={30} />
            <Bar dataKey="audits" name="审核" fill="#10B981" radius={[4, 4, 0, 0]} barSize={14} />
            <Bar dataKey="shipments" name="发货" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={14} />
            <Bar dataKey="disputes" name="投诉" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={14} />
            <Bar dataKey="riskFlags" name="拉黑事件" fill="#0F172A" radius={[4, 4, 0, 0]} barSize={14} />
            <Bar dataKey="recalls" name="召回" fill="#DC2626" radius={[4, 4, 0, 0]} barSize={14} />
            <Bar dataKey="reviewBlocks" name="审核拦截" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={14} />
          </BarChart>
        </ChartPanel>

        <ChartPanel title="电子监管风险快照">
          <BarChart data={electronicsRiskData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
            <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} width={110} />
            <Tooltip />
            <Bar dataKey="value" name="数量" fill="#334155" radius={[0, 4, 4, 0]} barSize={18} />
          </BarChart>
        </ChartPanel>

        <ChartPanel title="投诉类型分布">
          <BarChart data={complaintTypeData} margin={{ top: 12, right: 10, left: -10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748B", fontSize: 11 }}
              angle={-18}
              textAnchor="end"
              interval={0}
              height={55}
            />
            <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="投诉数" fill="#B91C1C" radius={[4, 4, 0, 0]} barSize={24} />
          </BarChart>
        </ChartPanel>
      </div>

      <div className="flex h-[36rem] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100">审计日志中心</h3>
            <p className="mt-1 text-[11px] text-slate-400">
              快速分组：{FILTER_OPTIONS.find((item) => item.id === selectedFilter)?.label || "全部日志"}
            </p>
          </div>
          <button
            onClick={exportAuditLogsCsv}
            className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
          >
            导出 CSV
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-3 border-b border-slate-800 bg-slate-950/60 px-5 py-4 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={auditLogFilters.keyword || ""}
              onChange={(event) => handleAuditLogFieldChange("keyword", event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="关键词 / 详情 / 哈希"
            />
            <input
              value={auditLogFilters.operatorKeyword || ""}
              onChange={(event) => handleAuditLogFieldChange("operatorKeyword", event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="操作人 / 角色"
            />
            <input
              value={auditLogFilters.targetId || ""}
              onChange={(event) => handleAuditLogFieldChange("targetId", event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="目标 ID"
            />
            <select
              value={auditLogFilters.action || ""}
              onChange={(event) => handleAuditLogFieldChange("action", event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">全部动作</option>
              {Object.entries(ACTION_LABELS).map(([action, label]) => (
                <option key={action} value={action}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={auditLogFilters.result || ""}
              onChange={(event) => handleAuditLogFieldChange("result", event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">全部结果</option>
              <option value="SUCCESS">成功</option>
              <option value="FAIL">失败</option>
            </select>
            <select
              value={auditLogFilters.targetType || ""}
              onChange={(event) => handleAuditLogFieldChange("targetType", event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">全部目标类型</option>
              {Object.entries(TARGET_LABELS).map(([targetType, label]) => (
                <option key={targetType} value={targetType}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={auditLogFilters.dateFrom || ""}
              onChange={(event) => handleAuditLogFieldChange("dateFrom", event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <input
              type="date"
              value={auditLogFilters.dateTo || ""}
              onChange={(event) => handleAuditLogFieldChange("dateTo", event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />

            <div className="md:col-span-2 xl:col-span-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleAuditLogSearch}
                  className="rounded bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                >
                  查询日志
                </button>
                <button
                  onClick={handleAuditLogReset}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                >
                  重置条件
                </button>
                <span className="text-xs text-slate-400">
                  已加载 {auditLogPagination.total || visibleAuditLogs.length} 条，当前第{" "}
                  {auditLogPagination.page || 1} / {Math.max(auditLogPagination.totalPages || 1, 1)} 页
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                {appliedFilterSummary.length > 0 ? (
                  appliedFilterSummary.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span>当前未应用高级检索条件</span>
                )}
              </div>
            </div>
          </div>

          <div className="border-b border-slate-800 bg-slate-950 px-5 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-100">链上凭证流</div>
                <div className="mt-1 text-xs text-slate-500">
                  将审计记录、合约事件和交易哈希串联展示，便于答辩时说明监管动作已形成链上凭证。
                </div>
              </div>
              <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                当前页链上凭证 {chainCredentialLogs.length} 条
              </div>
            </div>

            {chainCredentialLogs.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {chainCredentialLogs.map((log) => (
                  <div
                    key={`credential-${log.id}`}
                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-slate-900 px-2 py-1 font-semibold text-emerald-300">
                        审计记录 #{log.id}
                      </span>
                      <span className="rounded bg-slate-900 px-2 py-1 text-cyan-300">
                        合约事件：{log.contractEvent}
                      </span>
                      <span className="text-slate-400">{log.actionLabel}</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-300">{log.target}</div>
                    <div className="mt-2 break-all rounded bg-black/30 px-2 py-1 font-mono text-[11px] text-slate-400">
                      交易哈希：{shortenHash(log.txHash)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-500">
                当前页暂无可识别的链上交易哈希。可切换到“链上凭证”分组，或在关键词中搜索交易哈希。
              </div>
            )}

            <div className="mt-5 border-t border-slate-800 pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-100">链上证据时间线</div>
                  <div className="mt-1 text-xs text-slate-500">
                    按时间串联操作人、目标对象、合约事件、交易哈希与裁决结果。
                  </div>
                </div>
                <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                  最近 {chainEvidenceTimeline.length} 条
                </div>
              </div>

              {chainEvidenceTimeline.length > 0 ? (
                <div className="space-y-3">
                  {chainEvidenceTimeline.map((log, index) => (
                    <div key={`timeline-${log.id}`} className="relative pl-5">
                      <span className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-cyan-400" />
                      {index < chainEvidenceTimeline.length - 1 && (
                        <span className="absolute bottom-[-0.75rem] left-[4px] top-5 w-px bg-slate-800" />
                      )}
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={`font-semibold ${log.color}`}>{log.actionLabel}</span>
                          <span className="text-slate-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 ${
                              RESULT_STYLES[log.result] || "border border-slate-700 text-slate-300"
                            }`}
                          >
                            {log.resultLabel}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-2 text-xs text-slate-300 md:grid-cols-2">
                          <div>操作人：{log.operator}</div>
                          <div>目标：{log.target}</div>
                          <div>合约事件：{log.contractEvent || "未匹配"}</div>
                          <div>订单：{log.orderId || "未提供"}</div>
                          <div>商品：{log.productId || "未提供"}</div>
                          <div>裁决：{log.ruling || "未提供"}</div>
                        </div>
                        <div className="mt-2 break-all rounded bg-black/30 px-2 py-1 font-mono text-[11px] text-slate-500">
                          交易哈希：{log.txHash ? shortenHash(log.txHash) : "未提供"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-500">
                  当前页暂无可串联的链上证据。
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 p-5 font-mono text-sm">
            {auditLogLoading ? (
              <div className="mt-10 text-center text-slate-500">日志检索中...</div>
            ) : visibleAuditLogs.length === 0 ? (
              <div className="mt-10 text-center text-slate-500">当前条件下暂无审计日志。</div>
            ) : (
              visibleAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-slate-800 bg-black/20 px-4 py-3 transition hover:bg-slate-900/70"
                >
                  <div className="mb-2 flex flex-wrap gap-2 text-xs">
                    <span className="text-slate-400">[{new Date(log.timestamp).toLocaleString()}]</span>
                    <span className={`font-bold ${log.color}`}>[{log.actionLabel}]</span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        RESULT_STYLES[log.result] || "border border-slate-700 text-slate-300"
                      }`}
                    >
                      {log.resultLabel}
                    </span>
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-300">
                      审计记录 #{log.id}
                    </span>
                    {log.contractEvent ? (
                      <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-cyan-300">
                        合约事件：{log.contractEvent}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                    <div className="text-slate-300">
                      <span className="text-slate-500">操作人：</span>
                      {log.operator}
                    </div>
                    <div className="text-slate-300">
                      <span className="text-slate-500">目标：</span>
                      {log.target}
                    </div>
                    <div className="text-slate-300 md:col-span-2">
                      <span className="text-slate-500">详情：</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {log.detailItems.map((item, index) => (
                          <span
                            key={`${log.id}-${item.key}-${index}`}
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-200"
                          >
                            {item.label}: {item.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs lg:grid-cols-2">
                    <div className="break-all rounded bg-black/30 px-2 py-1 text-slate-500">
                      <span className="text-slate-400">交易哈希：</span>
                      {log.txHash ? (
                        <span title={log.txHash}>{shortenHash(log.txHash)}</span>
                      ) : (
                        "未提供"
                      )}
                    </div>
                    <div className="break-all rounded bg-black/30 px-2 py-1 text-slate-500">
                      <span className="text-slate-400">IPFS 证据：</span>
                      {log.ipfsHash ? (
                        <span title={log.ipfsHash}>{shortenHash(log.ipfsHash)}</span>
                      ) : (
                        "未提供"
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/80 px-5 py-3 text-xs text-slate-400">
          <div>
            第 {auditLogPagination.page || 1} 页，每页 {auditLogPagination.pageSize || 10} 条，共{" "}
            {auditLogPagination.total || visibleAuditLogs.length} 条
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleAuditLogPageChange((auditLogPagination.page || 1) - 1)}
              disabled={(auditLogPagination.page || 1) <= 1 || auditLogLoading}
              className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200 disabled:opacity-50"
            >
              上一页
            </button>
            <button
              onClick={() => handleAuditLogPageChange((auditLogPagination.page || 1) + 1)}
              disabled={
                (auditLogPagination.page || 1) >= Math.max(auditLogPagination.totalPages || 1, 1) ||
                auditLogLoading
              }
              className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #334155 #0f172a; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 9999px; }
      `}</style>
    </div>
  );
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function MetricCard({ label, value, className }) {
  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <div className="text-xs">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function ChartPanel({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-slate-600">{title}</h3>
      <div className="h-72">
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}
