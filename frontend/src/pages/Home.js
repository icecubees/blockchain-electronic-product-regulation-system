import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";

import ProductService from "../services/product.service";
import AuthService from "../services/auth.service";
import AuditLogService from "../services/audit-log.service";
import SystemSettingService from "../services/system-setting.service";
import BlacklistSellerManager from "../components/BlacklistSellerManager";
import Dashboard from "../components/Dashboard";
import RegulatorReviewQueues from "../components/RegulatorReviewQueues";
import SellerWalletBinder from "../components/SellerWalletBinder";

const PAGE_SIZE = 8;
const REGULATOR_PAGE_SIZE = 10;
const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

const CATEGORY_OPTIONS = [
  { value: "", label: "全部类别" },
  { value: "mobile_phone", label: "手机" },
  { value: "laptop", label: "笔记本电脑" },
  { value: "tablet", label: "平板电脑" },
  { value: "earphone", label: "耳机" },
  { value: "charger", label: "充电器" },
  { value: "power_bank", label: "充电宝" },
  { value: "smart_watch", label: "智能手表" },
  { value: "camera", label: "相机" },
  { value: "router", label: "路由器" },
  { value: "accessory", label: "配件" },
];

const INITIAL_FILTERS = {
  q: "",
  category: "",
  brand: "",
  isUsed: "",
  isRefurbished: "",
  recallStatus: "",
  cccStatus: "",
  minPrice: "",
  maxPrice: "",
  sellerId: "",
  sortBy: "latest",
};

const INITIAL_RECALL_MODAL = {
  product: null,
  reason: "存在潜在安全或合规召回风险。",
  batchNo: "",
};

const INITIAL_DELIST_MODAL = {
  product: null,
  reason: "平台监管下架",
};

const INITIAL_PURCHASE_MODAL = {
  product: null,
};

const INITIAL_PENDING_PRODUCT_FILTERS = {
  q: "",
  category: "",
  brand: "",
  sellerId: "",
};

const INITIAL_COMPLAINT_FILTERS = {
  q: "",
  orderId: "",
  complaintType: "",
  sellerId: "",
  buyerId: "",
  hasSellerResponse: "",
};

const INITIAL_AUDIT_LOG_FILTERS = {
  keyword: "",
  action: "",
  result: "",
  targetType: "",
  targetId: "",
  operatorKeyword: "",
  dateFrom: "",
  dateTo: "",
  page: 1,
  pageSize: REGULATOR_PAGE_SIZE,
};

const INITIAL_USER_FILTERS = {
  q: "",
  role: "",
  status: "",
  walletBound: "",
  page: 1,
  pageSize: REGULATOR_PAGE_SIZE,
};

const COMPLAINT_TYPE_OPTIONS = [
  { value: "", label: "全部投诉类型" },
  { value: "battery_issue", label: "电池问题" },
  { value: "counterfeit_suspected", label: "疑似假货" },
  { value: "refurbished_not_disclosed", label: "翻新未披露" },
  { value: "serial_number_mismatch", label: "序列号不一致" },
  { value: "performance_issue", label: "性能问题" },
  { value: "accessory_mismatch", label: "配件不符" },
  { value: "safety_risk", label: "安全风险" },
];

const USER_ROLE_OPTIONS = [
  { value: "", label: "全部角色" },
  { value: "buyer", label: "买家" },
  { value: "seller", label: "卖家" },
  { value: "regulator", label: "监督方" },
];

const USER_STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "0", label: "待审核" },
  { value: "1", label: "正常" },
  { value: "2", label: "已冻结" },
];

const WALLET_BOUND_OPTIONS = [
  { value: "", label: "全部钱包状态" },
  { value: "true", label: "已绑定钱包" },
  { value: "false", label: "未绑定钱包" },
];

const REGULATOR_NAV_ITEMS = [
  { key: "dashboard", label: "监管看板", description: "查看平台风险总览与审计信息" },
  { key: "complaints", label: "投诉处理", description: "集中处理买家投诉与监管裁决" },
  { key: "reviews", label: "审核队列", description: "审核待上架商品与商家申请" },
  { key: "blacklist", label: "黑名单商家", description: "管理已列入黑名单的卖家" },
  { key: "users", label: "用户治理", description: "冻结、解冻和筛查平台用户" },
  { key: "market", label: "市场商品", description: "查看和干预平台商品流通情况" },
];

const REGULATOR_SECTION_KEYS = REGULATOR_NAV_ITEMS.map((item) => item.key);
const REGULATOR_SCROLL_OFFSET = 112;

function isRegulatorUser(user) {
  return user?.role === "regulator";
}

function getUserRoleLabel(role) {
  return USER_ROLE_OPTIONS.find((option) => option.value === role)?.label || role;
}

function buildTraceUrl(product) {
  return `/trace?productId=${encodeURIComponent(product.id)}`;
}

function normalizeListResponse(response) {
  if (Array.isArray(response?.data)) {
    return response.data;
  }
  if (Array.isArray(response?.data?.items)) {
    return response.data.items;
  }
  return [];
}

function getPagination(response, fallbackPage) {
  const pagination = response?.data?.pagination || {};
  return {
    page: pagination.page || fallbackPage,
    pageSize: pagination.pageSize || PAGE_SIZE,
    total: pagination.total || 0,
    totalPages: pagination.totalPages || 1,
  };
}

function getErrorMessage(error) {
  return error?.response?.data?.message || error?.message || "未知错误";
}

function decimalWeiToHex(value) {
  let decimal = String(value || "0").replace(/^0+/, "");
  if (!decimal) {
    return "0x0";
  }

  const hexDigits = [];
  while (decimal) {
    let carry = 0;
    let next = "";

    for (let index = 0; index < decimal.length; index += 1) {
      const current = carry * 10 + Number(decimal[index]);
      const digit = Math.floor(current / 16);
      carry = current % 16;
      if (next || digit > 0) {
        next += String(digit);
      }
    }

    hexDigits.push(carry.toString(16));
    decimal = next;
  }

  return `0x${hexDigits.reverse().join("")}`;
}

function getComplaintOrderId(complaint) {
  return complaint.orderId || complaint.order?.id || complaint.id;
}

function getSellerName(product) {
  return (
    product?.seller?.username ||
    product?.sellerUsername ||
    (product?.sellerId ? `卖家#${product.sellerId}` : "未知卖家")
  );
}

function isProductRecalled(product) {
  return Boolean(product?.recallStatus || product?.recalled || product?.recallFlag);
}

function getRiskLabel(product) {
  const tags = Array.isArray(product?.riskTags)
    ? product.riskTags
    : Array.isArray(product?.highRiskTags)
      ? product.highRiskTags
      : product?.riskTag
        ? [product.riskTag]
        : [];

  if (tags.length > 0) {
    return tags.join("、");
  }

  if (product?.riskLevel) {
    return String(product.riskLevel);
  }

  return "";
}

function shortenAddress(value) {
  if (!value) {
    return "未提供";
  }

  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function getHealthTone(status) {
  if (status === "online") {
    return {
      dot: "bg-emerald-500",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      label: "正常",
    };
  }

  if (status === "disabled" || status === "not_configured") {
    return {
      dot: "bg-amber-500",
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      label: status === "disabled" ? "已关闭" : "未配置",
    };
  }

  if (status === "degraded") {
    return {
      dot: "bg-orange-500",
      badge: "border-orange-200 bg-orange-50 text-orange-700",
      label: "需检查",
    };
  }

  if (status === "offline") {
    return {
      dot: "bg-rose-500",
      badge: "border-rose-200 bg-rose-50 text-rose-700",
      label: "异常",
    };
  }

  return {
    dot: "bg-slate-400",
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    label: "待检测",
  };
}

function SystemStatusPanel({ health, loading, onRefresh }) {
  const items = [
    {
      key: "blockchain",
      label: "Ganache / 托管合约",
      status: health?.blockchain?.status,
      message: health?.blockchain?.message || "等待检测链服务状态",
      detail: health?.blockchain?.contractAddress
        ? `合约 ${shortenAddress(health.blockchain.contractAddress)}`
        : "合约地址未返回",
    },
    {
      key: "aiAudit",
      label: "AI 预审核",
      status: health?.aiAudit?.status,
      message: health?.aiAudit?.message || "等待检测 AI 审核开关",
      detail: health?.aiAudit?.enabled ? "发布商品会先进入 AI 预审" : "发布商品直接进入人工审核",
    },
    {
      key: "database",
      label: "数据库 / 迁移",
      status: health?.database?.status,
      message: health?.database?.message || "等待检测数据库连接",
      detail: health?.database?.migrationTableReady
        ? `已记录 ${health.database.executedMigrationCount || 0} 条迁移`
        : "迁移表未检测到",
    },
    {
      key: "pinata",
      label: "IPFS / Pinata",
      status: health?.pinata?.status,
      message: health?.pinata?.message || "等待检测文件上传凭据",
      detail: health?.pinata?.status === "online" ? "链下证据上传可用" : "不可用时进入补偿流程",
    },
  ];

  return (
    <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 shadow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-500">演示环境状态</div>
          <h2 className="mt-1 text-xl font-bold text-slate-900">区块链监管链路检查</h2>
          <p className="mt-1 text-sm text-slate-500">
            展示数据库、Ganache 合约、AI 审核与 IPFS 上传的当前可用状态。
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "检测中..." : "刷新状态"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const tone = getHealthTone(item.status);

          return (
            <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                  {item.label}
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tone.badge}`}>
                  {tone.label}
                </span>
              </div>
              <div className="mt-3 text-sm text-slate-600">{item.message}</div>
              <div className="mt-2 break-all text-xs text-slate-500">{item.detail}</div>
            </div>
          );
        })}
      </div>

      {health?.generatedAt && (
        <div className="mt-3 text-xs text-slate-400">
          最近检测：{new Date(health.generatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

function ComplaintEvidenceLink({ hash, label }) {
  if (!hash) {
    return null;
  }

  return (
    <a
      href={`${IPFS_GATEWAY}${hash}`}
      target="_blank"
      rel="noreferrer"
      className="text-indigo-600 underline hover:text-indigo-800"
    >
      {label}
    </a>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [pendingSellers, setPendingSellers] = useState([]);
  const [blacklistedSellers, setBlacklistedSellers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [aiAuditEnabled, setAiAuditEnabled] = useState(true);
  const [aiAuditSettingLoading, setAiAuditSettingLoading] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const [systemHealthLoading, setSystemHealthLoading] = useState(false);
  const [managedUsers, setManagedUsers] = useState([]);
  const [pendingProductFilters, setPendingProductFilters] = useState(INITIAL_PENDING_PRODUCT_FILTERS);
  const [appliedPendingProductFilters, setAppliedPendingProductFilters] = useState(
    INITIAL_PENDING_PRODUCT_FILTERS
  );
  const [complaintFilters, setComplaintFilters] = useState(INITIAL_COMPLAINT_FILTERS);
  const [appliedComplaintFilters, setAppliedComplaintFilters] = useState(INITIAL_COMPLAINT_FILTERS);
  const [auditLogFilters, setAuditLogFilters] = useState(INITIAL_AUDIT_LOG_FILTERS);
  const [appliedAuditLogFilters, setAppliedAuditLogFilters] = useState(INITIAL_AUDIT_LOG_FILTERS);
  const [userFilters, setUserFilters] = useState(INITIAL_USER_FILTERS);
  const [appliedUserFilters, setAppliedUserFilters] = useState(INITIAL_USER_FILTERS);
  const [auditLogPagination, setAuditLogPagination] = useState({
    page: 1,
    pageSize: REGULATOR_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [userPagination, setUserPagination] = useState({
    page: 1,
    pageSize: REGULATOR_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [marketLoading, setMarketLoading] = useState(false);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [marketPagination, setMarketPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [complaintRulings, setComplaintRulings] = useState({});
  const [qrProduct, setQrProduct] = useState(null);
  const [purchaseModal, setPurchaseModal] = useState(INITIAL_PURCHASE_MODAL);
  const [delistModal, setDelistModal] = useState(INITIAL_DELIST_MODAL);
  const [recallModal, setRecallModal] = useState(INITIAL_RECALL_MODAL);
  const [activeRegulatorSection, setActiveRegulatorSection] = useState("dashboard");
  const initialDataLoadersRef = useRef({
    loadMarketProducts: null,
    reloadRegulatorData: null,
  });
  const pendingRegulatorSectionRef = useRef(null);
  const pendingRegulatorTimerRef = useRef(null);

  const isRegulator = isRegulatorUser(currentUser);

  useEffect(() => {
    const user = AuthService.getCurrentUser();
    setCurrentUser(user || null);
    initialDataLoadersRef.current.loadMarketProducts?.(1, INITIAL_FILTERS);

    if (isRegulatorUser(user)) {
      initialDataLoadersRef.current.reloadRegulatorData?.(user);
    }
  }, []);

  useEffect(() => {
    if (!isRegulator) {
      return undefined;
    }

    let frameId = null;

    const syncActiveSection = () => {
      frameId = null;
      if (pendingRegulatorSectionRef.current) {
        return;
      }

      const anchorOffset = REGULATOR_SCROLL_OFFSET;
      let nextActiveSection = REGULATOR_SECTION_KEYS[0];

      REGULATOR_SECTION_KEYS.forEach((sectionKey) => {
        const section = document.getElementById(`regulator-section-${sectionKey}`);
        if (!section) {
          return;
        }

        if (section.getBoundingClientRect().top <= anchorOffset) {
          nextActiveSection = sectionKey;
        }
      });

      setActiveRegulatorSection((current) =>
        current === nextActiveSection ? current : nextActiveSection
      );
    };

    const requestSync = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(syncActiveSection);
    };

    requestSync();
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      if (pendingRegulatorTimerRef.current) {
        window.clearTimeout(pendingRegulatorTimerRef.current);
      }
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
    };
  }, [isRegulator]);

  const buildMarketParams = (page, nextFilters) => {
    const params = {
      page,
      pageSize: PAGE_SIZE,
      sortBy: nextFilters.sortBy,
    };

    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value === "" || value === null || value === undefined) {
        return;
      }
      params[key] = value;
    });

    return params;
  };

  const buildQueryParams = (source) => {
    const params = {};

    Object.entries(source).forEach(([key, value]) => {
      if (value === "" || value === null || value === undefined) {
        return;
      }
      params[key] = value;
    });

    return params;
  };

  const loadMarketProducts = async (page = 1, nextFilters = appliedFilters) => {
    setMarketLoading(true);
    try {
      const response = await ProductService.getAllProducts(buildMarketParams(page, nextFilters));
      const items = normalizeListResponse(response);
      const pagination = getPagination(response, page);

      setProducts(items);
      setMarketPagination({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total || items.length,
        totalPages: pagination.totalPages || 1,
      });
    } catch (error) {
      window.alert(`市场商品加载失败：${getErrorMessage(error)}`);
      setProducts([]);
    } finally {
      setMarketLoading(false);
    }
  };

  const loadPendingProducts = async (
    user = currentUser,
    nextFilters = appliedPendingProductFilters
  ) => {
    if (!isRegulatorUser(user)) {
      return;
    }

    try {
      const response = await ProductService.getPendingProducts(buildQueryParams(nextFilters));
      setPendingProducts(normalizeListResponse(response));
    } catch (error) {
      console.error(error);
    }
  };

  const loadPendingSellers = async (user = currentUser) => {
    if (!isRegulatorUser(user)) {
      return;
    }

    try {
      const response = await AuthService.getPendingSellers();
      setPendingSellers(normalizeListResponse(response));
    } catch (error) {
      console.error(error);
    }
  };

  const loadBlacklistedSellers = async (user = currentUser) => {
    if (!isRegulatorUser(user)) {
      return;
    }

    try {
      const response = await AuthService.getBlacklistedSellers();
      setBlacklistedSellers(normalizeListResponse(response));
    } catch (error) {
      console.error(error);
    }
  };

  const loadManagedUsers = async (user = currentUser, nextFilters = appliedUserFilters) => {
    if (!isRegulatorUser(user)) {
      return;
    }

    setUserLoading(true);
    try {
      const response = await AuthService.getUsers(buildQueryParams(nextFilters));
      const items = normalizeListResponse(response);
      const pagination = getPagination(response, nextFilters.page || 1);

      setManagedUsers(items);
      setUserPagination({
        page: pagination.page,
        pageSize: pagination.pageSize || nextFilters.pageSize || REGULATOR_PAGE_SIZE,
        total: pagination.total || items.length,
        totalPages: pagination.totalPages || 1,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setUserLoading(false);
    }
  };

  const loadComplaints = async (user = currentUser, nextFilters = appliedComplaintFilters) => {
    if (!isRegulatorUser(user)) {
      return;
    }

    try {
      const response = await ProductService.getAllComplaints(buildQueryParams(nextFilters));
      setComplaints(normalizeListResponse(response));
    } catch (error) {
      console.error(error);
    }
  };

  const loadAuditLogs = async (user = currentUser, nextFilters = appliedAuditLogFilters) => {
    if (!isRegulatorUser(user)) {
      return;
    }

    setAuditLogLoading(true);
    try {
      const response = await AuditLogService.getAuditLogs(buildQueryParams(nextFilters));
      const items = normalizeListResponse(response);
      const pagination = getPagination(response, nextFilters.page || 1);

      setAuditLogs(items);
      setAuditLogPagination({
        page: pagination.page,
        pageSize: pagination.pageSize || nextFilters.pageSize || REGULATOR_PAGE_SIZE,
        total: pagination.total || items.length,
        totalPages: pagination.totalPages || 1,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setAuditLogLoading(false);
    }
  };

  const loadAuditStats = async (user = currentUser) => {
    if (!isRegulatorUser(user)) {
      return;
    }

    try {
      const response = await AuditLogService.getAuditStats();
      setDashboardStats(response?.data || null);
    } catch (error) {
      console.error(error);
    }
  };

  const loadAiAuditSetting = async (user = currentUser) => {
    if (!isRegulatorUser(user)) {
      return;
    }

    try {
      const response = await SystemSettingService.getAiAuditSetting();
      setAiAuditEnabled(Boolean(response?.data?.enabled));
    } catch (error) {
      console.error(error);
    }
  };

  const loadSystemHealth = async (user = currentUser) => {
    if (!isRegulatorUser(user)) {
      return;
    }

    setSystemHealthLoading(true);
    try {
      const response = await SystemSettingService.getSystemHealth();
      setSystemHealth(response?.data || null);
    } catch (error) {
      setSystemHealth({
        generatedAt: new Date().toISOString(),
        database: { status: "offline", message: getErrorMessage(error) },
        blockchain: { status: "offline", message: "系统状态接口不可用" },
        aiAudit: {
          status: aiAuditEnabled ? "online" : "disabled",
          enabled: aiAuditEnabled,
          message: aiAuditEnabled ? "AI 预审核开关已开启" : "AI 预审核开关已关闭",
        },
        pinata: { status: "offline", message: "系统状态接口不可用" },
      });
    } finally {
      setSystemHealthLoading(false);
    }
  };

  const reloadRegulatorData = async (user = currentUser) => {
    if (!isRegulatorUser(user)) {
      return;
    }

    await Promise.all([
      loadPendingProducts(user, appliedPendingProductFilters),
      loadPendingSellers(user),
      loadBlacklistedSellers(user),
      loadManagedUsers(user, appliedUserFilters),
      loadComplaints(user, appliedComplaintFilters),
      loadAuditLogs(user, appliedAuditLogFilters),
      loadAuditStats(user),
      loadAiAuditSetting(user),
      loadSystemHealth(user),
    ]);
  };

  initialDataLoadersRef.current = {
    loadMarketProducts,
    reloadRegulatorData,
  };

  const refreshAfterMutation = async () => {
    await loadMarketProducts(marketPagination.page, appliedFilters);
    if (isRegulator) {
      await reloadRegulatorData();
    }
  };

  const gotoPage = (page) => {
    const targetPage = Math.min(Math.max(page, 1), Math.max(marketPagination.totalPages, 1));
    loadMarketProducts(targetPage, appliedFilters);
  };

  const handleFilterChange = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
  };

  const handlePendingProductFilterChange = (key, value) => {
    setPendingProductFilters((previous) => ({ ...previous, [key]: value }));
  };

  const handleComplaintFilterChange = (key, value) => {
    setComplaintFilters((previous) => ({ ...previous, [key]: value }));
  };

  const handleAuditLogFilterChange = (key, value) => {
    setAuditLogFilters((previous) => ({ ...previous, [key]: value }));
  };

  const handleUserFilterChange = (key, value) => {
    setUserFilters((previous) => ({ ...previous, [key]: value }));
  };

  const applyFilters = async () => {
    const nextFilters = { ...filters };
    setAppliedFilters(nextFilters);
    await loadMarketProducts(1, nextFilters);
  };

  const resetFilters = async () => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    await loadMarketProducts(1, INITIAL_FILTERS);
  };

  const applyPendingProductFilters = async () => {
    const nextFilters = { ...pendingProductFilters };
    setAppliedPendingProductFilters(nextFilters);
    await loadPendingProducts(currentUser, nextFilters);
  };

  const resetPendingProductFilters = async () => {
    setPendingProductFilters(INITIAL_PENDING_PRODUCT_FILTERS);
    setAppliedPendingProductFilters(INITIAL_PENDING_PRODUCT_FILTERS);
    await loadPendingProducts(currentUser, INITIAL_PENDING_PRODUCT_FILTERS);
  };

  const applyComplaintFilters = async () => {
    const nextFilters = { ...complaintFilters };
    setAppliedComplaintFilters(nextFilters);
    await loadComplaints(currentUser, nextFilters);
  };

  const resetComplaintFilters = async () => {
    setComplaintFilters(INITIAL_COMPLAINT_FILTERS);
    setAppliedComplaintFilters(INITIAL_COMPLAINT_FILTERS);
    await loadComplaints(currentUser, INITIAL_COMPLAINT_FILTERS);
  };

  const applyAuditLogFilters = async (override = {}) => {
    const nextFilters = {
      ...auditLogFilters,
      ...override,
    };
    setAuditLogFilters(nextFilters);
    setAppliedAuditLogFilters(nextFilters);
    await loadAuditLogs(currentUser, nextFilters);
  };

  const resetAuditLogFilters = async () => {
    setAuditLogFilters(INITIAL_AUDIT_LOG_FILTERS);
    setAppliedAuditLogFilters(INITIAL_AUDIT_LOG_FILTERS);
    await loadAuditLogs(currentUser, INITIAL_AUDIT_LOG_FILTERS);
  };

  const gotoAuditLogPage = async (page) => {
    const targetPage = Math.min(Math.max(page, 1), Math.max(auditLogPagination.totalPages, 1));
    await applyAuditLogFilters({ page: targetPage });
  };

  const applyUserFilters = async (override = {}) => {
    const nextFilters = {
      ...userFilters,
      ...override,
    };
    setUserFilters(nextFilters);
    setAppliedUserFilters(nextFilters);
    await loadManagedUsers(currentUser, nextFilters);
  };

  const resetUserFilters = async () => {
    setUserFilters(INITIAL_USER_FILTERS);
    setAppliedUserFilters(INITIAL_USER_FILTERS);
    await loadManagedUsers(currentUser, INITIAL_USER_FILTERS);
  };

  const gotoUserPage = async (page) => {
    const targetPage = Math.min(Math.max(page, 1), Math.max(userPagination.totalPages, 1));
    await applyUserFilters({ page: targetPage });
  };

  const handlePurchase = async (productId) => {
    setLoading(true);
    try {
      if (window.ethereum) {
        const response = await ProductService.prepareWalletPurchase(productId);
        const txConfig = response.data;
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const from = accounts?.[0];

        if (!from) {
          throw new Error("未选择 MetaMask 账户");
        }

        const txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from,
              to: txConfig.contractAddress,
              data: txConfig.data,
              value: decimalWeiToHex(txConfig.value),
            },
          ],
        });

        await ProductService.finalizeWalletPurchase(productId, txHash);
        window.alert("链上托管购买成功，ETH 已锁定在合约中。请前往订单中心查看。");
      } else {
        await ProductService.purchaseProduct(productId);
        window.alert("购买成功，请前往订单中心查看。");
      }
      setPurchaseModal(INITIAL_PURCHASE_MODAL);
      await refreshAfterMutation();
    } catch (error) {
      window.alert(`购买失败：${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelist = async (productId, reason) => {
    const trimmedReason = String(reason || "").trim();
    if (!trimmedReason) {
      window.alert("请输入下架原因。");
      return;
    }

    setLoading(true);
    try {
      await ProductService.delistProduct(productId, trimmedReason);
      window.alert("商品下架成功。");
      setDelistModal(INITIAL_DELIST_MODAL);
      await refreshAfterMutation();
    } catch (error) {
      window.alert(`商品下架失败：${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecall = async (productId, reason, batchNo = "") => {
    const trimmedReason = String(reason || "").trim();
    if (!trimmedReason) {
      window.alert("请输入召回原因。");
      return;
    }

    setLoading(true);
    try {
      const response = await ProductService.recallProduct(productId, trimmedReason, batchNo);
      const notificationsCreated = Number(response?.data?.notificationsCreated || 0);
      window.alert(
        notificationsCreated > 0
          ? `商品召回成功。已生成 ${notificationsCreated} 条召回通知。`
          : "商品召回成功。"
      );
      setRecallModal(INITIAL_RECALL_MODAL);
      await refreshAfterMutation();
    } catch (error) {
      window.alert(`商品召回失败：${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (orderId, buyerWon) => {
    setLoading(true);
    try {
      const rulingDetails = complaintRulings[orderId] || "";
      await ProductService.resolveComplaint(orderId, buyerWon, rulingDetails);
      window.alert("投诉裁决成功。");
      setComplaintRulings((previous) => ({ ...previous, [orderId]: "" }));
      await reloadRegulatorData();
    } catch (error) {
      window.alert(`投诉裁决失败：${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSellerReview = async (sellerId, action, reason) => {
    setLoading(true);
    try {
      await AuthService.approveSeller(sellerId, action, reason);
      window.alert(action === "approve" ? "卖家审核通过。" : "卖家申请已驳回。");
      await reloadRegulatorData();
    } catch (error) {
      window.alert(`卖家审核失败：${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleProductReview = async (productId, decision, reason, reasonCodes = []) => {
    setLoading(true);
    try {
      await ProductService.auditProduct(productId, decision, reason, reasonCodes);
      window.alert(decision === 1 ? "商品审核通过。" : "商品审核已驳回。");
      await refreshAfterMutation();
    } catch (error) {
      window.alert(`商品审核失败：${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAiAudit = async () => {
    const nextEnabled = !aiAuditEnabled;
    setAiAuditSettingLoading(true);
    try {
      const response = await SystemSettingService.updateAiAuditSetting(nextEnabled);
      setAiAuditEnabled(Boolean(response?.data?.enabled));
      window.alert(nextEnabled ? "AI 审核已开启。" : "AI 审核已关闭，商品将直接进入人工审核。");
      await Promise.all([
        loadAuditLogs(currentUser, appliedAuditLogFilters),
        loadAuditStats(currentUser),
        loadSystemHealth(currentUser),
      ]);
    } catch (error) {
      window.alert(`AI 审核设置更新失败：${getErrorMessage(error)}`);
    } finally {
      setAiAuditSettingLoading(false);
    }
  };

  const handleRestoreSeller = async (sellerId, reason, restoredScore) => {
    setLoading(true);
    try {
      await AuthService.unblacklistSeller(sellerId, reason, restoredScore);
      window.alert("卖家已移出黑名单。");
      await reloadRegulatorData();
    } catch (error) {
      window.alert(`恢复卖家失败：${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserStatus = async (user, nextStatus) => {
    const isFreezing = nextStatus === 2;
    const reason = window.prompt(
      isFreezing ? "请输入冻结原因" : "请输入解冻备注（可选）",
      user?.frozenReason || ""
    );

    if (reason === null) {
      return;
    }
    if (isFreezing && !String(reason).trim()) {
      window.alert("冻结用户时必须填写原因。");
      return;
    }

    setLoading(true);
    try {
      await AuthService.updateUserStatus(user.id, nextStatus, reason);
      window.alert(nextStatus === 2 ? "用户已冻结。" : "用户已恢复正常。");
      await reloadRegulatorData();
    } catch (error) {
      window.alert(`用户状态更新失败：${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const copyWalletAddress = async (walletAddress) => {
    if (!walletAddress) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(walletAddress);
      }
      window.alert("钱包地址已复制。");
    } catch (error) {
      window.alert("复制失败，请手动复制钱包地址。");
    }
  };

  const openPurchaseModal = (product) => setPurchaseModal({ product });
  const openDelistModal = (product) =>
    setDelistModal({
      product,
      reason: "平台监管下架",
    });
  const openRecallModal = (product) =>
    setRecallModal({
      product,
      reason: "存在潜在安全或合规召回风险。",
      batchNo: product?.batchNo || "",
    });

  const logout = () => {
    AuthService.logout();
    setCurrentUser(null);
    navigate("/login");
  };

  const canDelistProduct = (product) => {
    if (!currentUser) {
      return false;
    }

    if (isRegulator) {
      return true;
    }

    return currentUser.role === "seller" && product?.seller?.id === currentUser.id;
  };

  const marketSummaryText = `当前页 ${products.length} 件商品，共 ${marketPagination.total} 件`;
  const handleWalletBound = (walletAddress) => {
    setCurrentUser((previous) =>
      previous
        ? {
            ...previous,
            ethAddress: walletAddress,
            walletBound: true,
          }
        : previous
    );
  };

  const scrollToRegulatorSection = (sectionKey) => {
    pendingRegulatorSectionRef.current = sectionKey;
    if (pendingRegulatorTimerRef.current) {
      window.clearTimeout(pendingRegulatorTimerRef.current);
    }
    setActiveRegulatorSection(sectionKey);
    const section = document.getElementById(`regulator-section-${sectionKey}`);
    if (section) {
      const top = section.getBoundingClientRect().top + window.scrollY - REGULATOR_SCROLL_OFFSET;
      window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
    }
    pendingRegulatorTimerRef.current = window.setTimeout(() => {
      pendingRegulatorSectionRef.current = null;
    }, 900);
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">电子产品交易监管平台</h1>
            <p className="mt-1 text-sm text-slate-500">
              {currentUser
                ? `${currentUser.username} / ${getUserRoleLabel(currentUser.role)}`
                : "欢迎进入电子产品交易监管平台"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentUser?.role === "buyer" && (
              <button
                onClick={() => navigate("/orders")}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                我的订单
              </button>
            )}

            {currentUser?.role === "seller" && (
              <>
                <button
                  onClick={() => navigate("/add")}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  发布商品
                </button>
                <button
                  onClick={() => navigate("/my-products")}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  我的商品
                </button>
                <button
                  onClick={() => navigate("/orders")}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  销售订单
                </button>
              </>
            )}

            {currentUser ? (
              <button
                onClick={logout}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                退出登录
              </button>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                登录
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className={isRegulator ? "regulator-workspace grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]" : "space-y-6"}>
          {isRegulator && (
            <aside className="regulator-sidebar h-fit rounded-3xl bg-slate-900 p-4 text-white shadow-lg lg:sticky lg:top-28">
              <div className="border-b border-white/10 pb-4">
                <div className="text-xs font-semibold tracking-[0.24em] text-slate-300">
                  监督控制台
                </div>
                <h2 className="mt-2 text-xl font-bold">监督方工作台</h2>
                <p className="mt-2 text-sm text-slate-300">
                  点击左侧模块可快速定位到对应监督项目。
                </p>
              </div>

              <nav className="mt-4 space-y-2">
                {REGULATOR_NAV_ITEMS.map((item) => {
                  const isActive = item.key === activeRegulatorSection;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => scrollToRegulatorSection(item.key)}
                      className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                        isActive
                          ? "bg-white text-slate-900 shadow"
                          : "bg-white/5 text-slate-100 hover:bg-white/10"
                      }`}
                    >
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className={`mt-1 text-xs ${isActive ? "text-slate-500" : "text-slate-300"}`}>
                        {item.description}
                      </div>
                    </button>
                  );
                })}
              </nav>
            </aside>
          )}

          <div className="regulator-content space-y-6">
        {isRegulator && (
          <>
            <section id="regulator-section-dashboard" className="scroll-mt-40">
              <SystemStatusPanel
                health={systemHealth}
                loading={systemHealthLoading}
                onRefresh={() => loadSystemHealth(currentUser)}
              />
              <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 shadow">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-500">智能审核控制</div>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      AI 预审核：{aiAuditEnabled ? "已开启" : "已关闭"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      关闭后，卖家发布或重新提交商品时不会调用 AI 服务，商品会直接进入人工审核队列。
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={aiAuditEnabled}
                    onClick={handleToggleAiAudit}
                    disabled={aiAuditSettingLoading}
                    className={`relative h-11 w-36 rounded-full px-2 text-sm font-semibold transition disabled:opacity-60 ${
                      aiAuditEnabled
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-800 text-white"
                    }`}
                  >
                    <span className={`absolute top-1/2 -translate-y-1/2 ${aiAuditEnabled ? "left-4" : "right-4"}`}>
                      {aiAuditEnabled ? "开启中" : "已关闭"}
                    </span>
                    <span
                      className={`absolute top-1.5 h-8 w-8 rounded-full bg-white shadow transition ${
                        aiAuditEnabled ? "right-1.5" : "left-1.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
              <Dashboard
              products={products}
              pendingProducts={pendingProducts}
              complaints={complaints}
              auditLogs={auditLogs}
              stats={dashboardStats}
              auditLogFilters={auditLogFilters}
              appliedAuditLogFilters={appliedAuditLogFilters}
              auditLogPagination={auditLogPagination}
              auditLogLoading={auditLogLoading}
              onAuditLogFilterChange={handleAuditLogFilterChange}
              onAuditLogSearch={applyAuditLogFilters}
              onAuditLogReset={resetAuditLogFilters}
              onAuditLogPageChange={gotoAuditLogPage}
              />
            </section>

            <section id="regulator-section-complaints" className="scroll-mt-6 rounded-3xl bg-white p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">投诉处理区</h2>
                  <p className="mt-1 text-sm text-slate-500">集中处理买家投诉、卖家答辩与监管裁决。</p>
                </div>
              </div>

              <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3 xl:grid-cols-6">
                <input
                  value={complaintFilters.q}
                  onChange={(event) => handleComplaintFilterChange("q", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="搜索投诉原因或答辩"
                />
                <input
                  value={complaintFilters.orderId}
                  onChange={(event) => handleComplaintFilterChange("orderId", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="订单 ID"
                />
                <select
                  value={complaintFilters.complaintType}
                  onChange={(event) => handleComplaintFilterChange("complaintType", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {COMPLAINT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={complaintFilters.sellerId}
                  onChange={(event) => handleComplaintFilterChange("sellerId", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="卖家 ID"
                />
                <input
                  value={complaintFilters.buyerId}
                  onChange={(event) => handleComplaintFilterChange("buyerId", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="买家 ID"
                />
                <select
                  value={complaintFilters.hasSellerResponse}
                  onChange={(event) =>
                    handleComplaintFilterChange("hasSellerResponse", event.target.value)
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">卖家答辩状态</option>
                  <option value="true">已有答辩</option>
                  <option value="false">暂无答辩</option>
                </select>
                <div className="flex gap-3 xl:col-span-6">
                  <button
                    onClick={applyComplaintFilters}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    查询投诉
                  </button>
                  <button
                    onClick={resetComplaintFilters}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    重置
                  </button>
                </div>
              </div>

              {complaints.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  当前暂无待处理投诉。
                </div>
              ) : (
                <div className="space-y-4">
                  {complaints.map((complaint) => {
                    const orderId = getComplaintOrderId(complaint);
                    const buyerEvidence =
                      complaint.evidenceIpfsHash || complaint.buyerEvidenceIpfsHash;
                    const sellerEvidence =
                      complaint.sellerEvidenceIpfsHash ||
                      complaint.sellerResponseEvidenceIpfsHash ||
                      complaint.order?.sellerEvidenceIpfsHash;

                    return (
                      <div
                        key={`${complaint.id}-${orderId}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="text-lg font-semibold text-slate-900">
                              订单 #{orderId}
                            </div>
                            <div className="mt-1 text-sm text-slate-600">
                              买家：
                              {complaint.buyer?.username ||
                                complaint.order?.buyer?.username ||
                                "未知买家"}
                            </div>
                            <div className="mt-1 text-sm text-slate-600">
                              投诉原因：
                              {complaint.reason || complaint.complaintReason || "未提供"}
                            </div>
                            <div className="mt-1 text-sm text-slate-600">
                              卖家答辩：
                              {complaint.sellerResponse ||
                                complaint.order?.sellerResponse ||
                                "暂无答辩"}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-4 text-sm">
                              <ComplaintEvidenceLink hash={buyerEvidence} label="买家证据链接" />
                              <ComplaintEvidenceLink hash={sellerEvidence} label="卖家证据链接" />
                            </div>
                          </div>
                          <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                            待裁决
                          </div>
                        </div>

                        <div className="mt-4">
                          <label
                            htmlFor={`complaint-ruling-${orderId}`}
                            className="mb-2 block text-sm font-medium text-slate-700"
                          >
                            裁决说明
                          </label>
                          <textarea
                            id={`complaint-ruling-${orderId}`}
                            value={complaintRulings[orderId] || ""}
                            onChange={(event) =>
                              setComplaintRulings((previous) => ({
                                ...previous,
                                [orderId]: event.target.value,
                              }))
                            }
                            rows={3}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            placeholder="请输入裁决说明"
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            onClick={() => handleResolve(orderId, true)}
                            disabled={loading}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {loading ? "处理中..." : "判买家胜诉"}
                          </button>
                          <button
                            onClick={() => handleResolve(orderId, false)}
                            disabled={loading}
                            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                          >
                            {loading ? "处理中..." : "判卖家胜诉"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section id="regulator-section-reviews" className="scroll-mt-6 rounded-3xl bg-white p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">待审核商品筛查</h2>
                  <p className="mt-1 text-sm text-slate-500">先筛选，再进入审核队列处理。</p>
                </div>
              </div>

              <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
                <input
                  value={pendingProductFilters.q}
                  onChange={(event) => handlePendingProductFilterChange("q", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="搜索商品名称/描述/型号"
                />
                <select
                  value={pendingProductFilters.category}
                  onChange={(event) =>
                    handlePendingProductFilterChange("category", event.target.value)
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={pendingProductFilters.brand}
                  onChange={(event) => handlePendingProductFilterChange("brand", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="品牌"
                />
                <input
                  value={pendingProductFilters.sellerId}
                  onChange={(event) =>
                    handlePendingProductFilterChange("sellerId", event.target.value)
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="卖家 ID"
                />
                <div className="flex gap-3 xl:col-span-4">
                  <button
                    onClick={applyPendingProductFilters}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    查询待审核商品
                  </button>
                  <button
                    onClick={resetPendingProductFilters}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    重置
                  </button>
                </div>
              </div>

              <RegulatorReviewQueues
                pendingProducts={pendingProducts}
                pendingSellers={pendingSellers}
                loading={loading}
                onSellerReview={handleSellerReview}
                onProductReview={handleProductReview}
                onForceDelist={openDelistModal}
                onRecall={handleRecall}
              />
            </section>

            <section id="regulator-section-blacklist" className="scroll-mt-6">
              <BlacklistSellerManager
                sellers={blacklistedSellers}
                loading={loading}
                onRestore={handleRestoreSeller}
              />
            </section>

            <section id="regulator-section-users" className="scroll-mt-6 rounded-3xl bg-white p-6 shadow">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">用户治理</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    监督方可查看全部用户，并治理买家、卖家账号；同角色账号不支持互相治理。
                  </p>
                </div>
              </div>

              <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-5">
                <input
                  value={userFilters.q}
                  onChange={(event) => handleUserFilterChange("q", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="搜索用户名或钱包地址"
                />
                <select
                  value={userFilters.role}
                  onChange={(event) => handleUserFilterChange("role", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {USER_ROLE_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={userFilters.status}
                  onChange={(event) => handleUserFilterChange("status", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {USER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={userFilters.walletBound}
                  onChange={(event) => handleUserFilterChange("walletBound", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {WALLET_BOUND_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-3 xl:col-span-1">
                  <button
                    onClick={() => applyUserFilters({ page: 1 })}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    查询用户
                  </button>
                  <button
                    onClick={resetUserFilters}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    重置
                  </button>
                </div>
              </div>

              {userLoading ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  用户列表加载中...
                </div>
              ) : managedUsers.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  当前筛选条件下暂无用户。
                </div>
              ) : (
                <div className="space-y-3">
                  {managedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1 text-sm text-slate-700">
                          <div className="text-base font-semibold text-slate-900">
                            {user.username} #{user.id}
                          </div>
                          <div>角色：{getUserRoleLabel(user.role)}</div>
                          <div>状态：{USER_STATUS_OPTIONS.find((option) => option.value === String(user.status))?.label || user.status}</div>
                          <div className="break-all">
                            真实钱包：
                            {user.walletBound && user.ethAddress ? (
                              <span className="inline-flex flex-wrap items-center gap-2">
                                <span className="font-mono text-slate-900">{user.ethAddress}</span>
                                <button
                                  type="button"
                                  onClick={() => copyWalletAddress(user.ethAddress)}
                                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                  复制
                                </button>
                              </span>
                            ) : (
                              <span className="text-slate-500">未绑定</span>
                            )}
                          </div>
                          {user.frozenReason && <div>冻结原因：{user.frozenReason}</div>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleUpdateUserStatus(user, 2)}
                            disabled={loading || !user.canManage || user.status === 2}
                            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            冻结
                          </button>
                          <button
                            onClick={() => handleUpdateUserStatus(user, 1)}
                            disabled={loading || !user.canManage || user.status === 1}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            解冻
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                <div>
                  第 {userPagination.page} / {Math.max(userPagination.totalPages, 1)} 页，共{" "}
                  {userPagination.total} 个用户
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => gotoUserPage(userPagination.page - 1)}
                    disabled={userPagination.page <= 1 || userLoading}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => gotoUserPage(userPagination.page + 1)}
                    disabled={userPagination.page >= userPagination.totalPages || userLoading}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        <section id="regulator-section-market" className="scroll-mt-6 rounded-3xl bg-white p-6 shadow">
          {currentUser?.role === "buyer" && (
            <div className="mb-6">
              <SellerWalletBinder accountRole="buyer" onWalletBound={handleWalletBound} />
            </div>
          )}

          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">市场商品</h2>
              <p className="mt-1 text-sm text-slate-500">{marketSummaryText}</p>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={filters.q}
              onChange={(event) => handleFilterChange("q", event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="搜索商品名称或描述"
            />

            <select
              value={filters.category}
              onChange={(event) => handleFilterChange("category", event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              value={filters.brand}
              onChange={(event) => handleFilterChange("brand", event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="品牌"
            />

            <input
              value={filters.sellerId}
              onChange={(event) => handleFilterChange("sellerId", event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="卖家 ID"
            />

            <select
              value={filters.isUsed}
              onChange={(event) => handleFilterChange("isUsed", event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">二手状态</option>
              <option value="true">二手</option>
              <option value="false">非二手</option>
            </select>

            <select
              value={filters.isRefurbished}
              onChange={(event) => handleFilterChange("isRefurbished", event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">翻新状态</option>
              <option value="true">翻新</option>
              <option value="false">非翻新</option>
            </select>

            <select
              value={filters.recallStatus}
              onChange={(event) => handleFilterChange("recallStatus", event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">召回状态</option>
              <option value="true">已召回</option>
              <option value="false">未召回</option>
            </select>

            <select
              value={filters.cccStatus}
              onChange={(event) => handleFilterChange("cccStatus", event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">CCC 状态</option>
              <option value="complete">CCC 完整</option>
              <option value="missing">缺少 CCC</option>
            </select>

            <input
              type="number"
              value={filters.minPrice}
              onChange={(event) => handleFilterChange("minPrice", event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="最低价格"
            />

            <input
              type="number"
              value={filters.maxPrice}
              onChange={(event) => handleFilterChange("maxPrice", event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="最高价格"
            />

            <select
              value={filters.sortBy}
              onChange={(event) => handleFilterChange("sortBy", event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="latest">最新上架</option>
              <option value="priceAsc">价格升序</option>
              <option value="priceDesc">价格降序</option>
              <option value="stockDesc">库存优先</option>
            </select>

            <div className="flex gap-3 xl:col-span-2">
              <button
                onClick={applyFilters}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                应用筛选
              </button>
              <button
                onClick={resetFilters}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                重置
              </button>
            </div>
          </div>

          {marketLoading ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
              处理中...
            </div>
          ) : products.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
              当前没有符合条件的商品。
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => {
                const recalled = isProductRecalled(product);
                const riskLabel = getRiskLabel(product);

                return (
                  <div key={product.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">{product.description || "暂无描述"}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                        {CATEGORY_OPTIONS.find((item) => item.value === product.category)?.label ||
                          product.category ||
                          "未分类"}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      {recalled && (
                        <span className="rounded-full bg-rose-100 px-3 py-1 font-semibold text-rose-700">
                          已召回
                        </span>
                      )}
                      {product.isUsed && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">
                          二手
                        </span>
                      )}
                      {product.isRefurbished && (
                        <span className="rounded-full bg-indigo-100 px-3 py-1 font-semibold text-indigo-700">
                          翻新
                        </span>
                      )}
                      {riskLabel && (
                        <span className="rounded-full bg-slate-200 px-3 py-1 font-semibold text-slate-700">
                          风险：{riskLabel}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-slate-700">
                      <div>价格：{product.price} ETH</div>
                      <div>卖家：{getSellerName(product)}</div>
                      <div>库存：{product.stock ?? 0}</div>
                      {recalled && (
                        <div className="text-rose-700">
                          召回提示：{product.recallReason || "该商品已被召回，请勿继续流通。"}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        onClick={() => navigate(buildTraceUrl(product))}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        追溯报告
                      </button>
                      <button
                        onClick={() => setQrProduct(product)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        二维码
                      </button>

                      {currentUser?.role === "buyer" && !recalled && (
                        <button
                          onClick={() => openPurchaseModal(product)}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                          立即购买
                        </button>
                      )}

                      {isRegulator && (
                        <button
                          onClick={() => openRecallModal(product)}
                          className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                        >
                          召回
                        </button>
                      )}

                      {canDelistProduct(product) && (
                        <button
                          onClick={() => openDelistModal(product)}
                          className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                        >
                          下架
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-500">
              第 {marketPagination.page} / {Math.max(marketPagination.totalPages, 1)} 页
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => gotoPage(marketPagination.page - 1)}
                disabled={marketPagination.page <= 1}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
              >
                上一页
              </button>
              <button
                onClick={() => gotoPage(marketPagination.page + 1)}
                disabled={marketPagination.page >= marketPagination.totalPages}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        </section>
          </div>
        </div>
      </main>

      {qrProduct && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">{qrProduct.name}</div>
                <div className="mt-1 text-sm text-slate-500">{buildTraceUrl(qrProduct)}</div>
              </div>
              <button
                onClick={() => setQrProduct(null)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600"
              >
                关闭
              </button>
            </div>

            <div className="mt-6 flex justify-center">
              <QRCodeCanvas value={buildTraceUrl(qrProduct)} size={220} />
            </div>
          </div>
        </div>
      )}

      {purchaseModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5">
              <h3 className="text-lg font-semibold text-slate-900">确认购买</h3>
              <p className="mt-1 text-sm text-slate-500">{purchaseModal.product.name}</p>
            </div>

            <div className="p-5">
              <div className="text-sm text-slate-600">
                将通过 MetaMask 向托管合约支付商品价格，确认收货前资金会锁定在链上。
                若浏览器未检测到 MetaMask，则使用后端托管交易演示入口。
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setPurchaseModal(INITIAL_PURCHASE_MODAL)}
                  disabled={loading}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-slate-700 hover:bg-slate-200"
                >
                  取消
                </button>
                <button
                  onClick={() => handlePurchase(purchaseModal.product.id)}
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
                >
                  {loading ? "处理中..." : "确认购买"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {delistModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5">
              <h3 className="text-lg font-semibold text-slate-900">商品下架</h3>
              <p className="mt-1 text-sm text-slate-500">{delistModal.product.name}</p>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label htmlFor="delist-reason" className="mb-2 block text-sm font-medium text-slate-700">
                  下架原因
                </label>
                <textarea
                  id="delist-reason"
                  rows={3}
                  value={delistModal.reason}
                  onChange={(event) =>
                    setDelistModal((previous) => ({ ...previous, reason: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDelistModal(INITIAL_DELIST_MODAL)}
                  disabled={loading}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-slate-700 hover:bg-slate-200"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelist(delistModal.product.id, delistModal.reason)}
                  disabled={loading}
                  className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700"
                >
                  {loading ? "处理中..." : "确认下架"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {recallModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5">
              <h3 className="text-lg font-semibold text-slate-900">商品召回</h3>
              <p className="mt-1 text-sm text-slate-500">{recallModal.product.name}</p>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label htmlFor="recall-reason" className="mb-2 block text-sm font-medium text-slate-700">
                  召回原因
                </label>
                <textarea
                  id="recall-reason"
                  rows={3}
                  value={recallModal.reason}
                  onChange={(event) =>
                    setRecallModal((previous) => ({ ...previous, reason: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="recall-batch" className="mb-2 block text-sm font-medium text-slate-700">
                  召回批次号
                </label>
                <input
                  id="recall-batch"
                  value={recallModal.batchNo}
                  onChange={(event) =>
                    setRecallModal((previous) => ({ ...previous, batchNo: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setRecallModal(INITIAL_RECALL_MODAL)}
                  disabled={loading}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-slate-700 hover:bg-slate-200"
                >
                  取消
                </button>
                <button
                  onClick={() =>
                    handleRecall(recallModal.product.id, recallModal.reason, recallModal.batchNo)
                  }
                  disabled={loading}
                  className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700"
                >
                  {loading ? "处理中..." : "确认召回"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
