import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import AuthService from "../services/auth.service";
import ProductService from "../services/product.service";

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

const CATEGORY_LABELS = {
  mobile_phone: "手机",
  laptop: "笔记本电脑",
  tablet: "平板电脑",
  earphone: "耳机",
  charger: "充电器",
  power_bank: "充电宝",
  smart_watch: "智能手表",
  camera: "相机",
  router: "路由器",
  accessory: "配件",
};

const AUDIT_STATUS_LABELS = {
  0: "待审核",
  1: "已通过",
  2: "已驳回 / 已下架",
};

const ORDER_STATUS_LABELS = {
  0: "锁定中",
  1: "已放款",
  2: "已完成",
  3: "争议中",
  4: "已退款",
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

const REASON_CODE_LABELS = {
  missing_ccc_information: "缺少 CCC 信息",
  missing_device_identifier: "缺少设备唯一标识",
  undisclosed_refurbished_status: "未披露翻新状态",
  battery_safety_concern: "电池安全风险",
  report_model_mismatch: "报告与申报型号不一致",
  suspected_counterfeit: "疑似假货或未经授权产品",
};

const AFTER_SALES_TYPE_LABELS = {
  warranty_claim: "保修申请",
  repair: "维修",
  component_replacement: "部件更换",
  quality_refund: "质量退款",
};

const TIMELINE_ACTION_LABELS = {
  PRODUCT_COMPLIANCE_UPDATED: "合规摘要更新",
  PRODUCT_RECALL_FLAGGED: "召回标记",
  PRODUCT_REPAIR_RECORDED: "维修记录",
  PRODUCT_REFURBISH_DECLARED: "翻新声明",
  WARRANTY_UPDATED: "质保更新",
};

const RISK_LEVEL_LABELS = {
  0: "低",
  1: "中",
  2: "高",
  low: "低",
  medium: "中",
  high: "高",
};

const VIEWER_ROLE_COPY = {
  regulator: {
    label: "监管视图",
    description: "展示监管审查、链上摘要、订单争议与售后全量信息。",
    homeLabel: "返回监管首页",
  },
  seller: {
    label: "商家视图",
    description: "展示经营履约、审核结果、售后记录等商家履责相关信息。",
    homeLabel: "返回商家首页",
  },
  buyer: {
    label: "买家视图",
    description: "展示购买决策、安全合规与售后保障相关信息，隐藏内部监管细节。",
    homeLabel: "返回首页",
  },
};

function getViewerRole(user) {
  if (user?.role === "regulator" || user?.role === "admin") {
    return "regulator";
  }
  if (user?.role === "seller") {
    return "seller";
  }
  return "buyer";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "未提供";
}

function formatBoolean(value) {
  if (value === true) return "是";
  if (value === false) return "否";
  return "未提供";
}

function formatCategory(value) {
  return CATEGORY_LABELS[value] || value || "未提供";
}

function maskValue(value, prefix = 3, suffix = 2) {
  if (!value) {
    return "未提供";
  }

  const text = String(value);
  if (text.length <= prefix + suffix) {
    return text;
  }

  return `${text.slice(0, prefix)}***${text.slice(-suffix)}`;
}

function parseDetails(details) {
  if (!details) return [];

  try {
    const parsed = typeof details === "string" ? JSON.parse(details) : details;
    return Object.entries(parsed);
  } catch (error) {
    return [["details", String(details)]];
  }
}

function renderRiskPill(level, tag) {
  const styles = {
    low: "bg-emerald-100 text-emerald-700",
    medium: "bg-amber-100 text-amber-700",
    high: "bg-rose-100 text-rose-700",
  };

  return (
    <span
      key={tag}
      className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[level] || "bg-slate-100 text-slate-700"}`}
    >
      {tag}
    </span>
  );
}

function StatusBadge({ active, label }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-sm font-semibold ${
        active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-900">{value || "未提供"}</span>
    </div>
  );
}

function LegacyTraceFallback({ params }) {
  const name = params.get("name") || "未知商品";
  const price = params.get("price") || "0";
  const seller = params.get("seller") || "未知卖家";
  const score = params.get("score") || "60";
  const txCount = params.get("tx") || "0";
  const ipfs = params.get("ipfs");
  const cert = params.get("cert");

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="bg-slate-900 px-8 py-8 text-white">
          <h1 className="text-3xl font-bold">旧版追溯视图</h1>
          <p className="mt-2 text-slate-300">
            当前二维码不包含商品 ID，因此只能展示旧版静态字段。
          </p>
        </div>

        <div className="grid gap-6 p-8 md:grid-cols-2">
          <div className="space-y-4">
            <InfoRow label="商品名称" value={name} />
            <InfoRow label="价格" value={`${price} ETH`} />
            <InfoRow label="卖家" value={seller} />
          </div>

          <div className="space-y-4">
            <InfoRow label="卖家信誉分" value={score} />
            <InfoRow label="历史交易数" value={txCount} />
            <div className="flex flex-wrap gap-3">
              {ipfs && ipfs !== "NoReport" && (
                <a
                  href={`${IPFS_GATEWAY}${ipfs}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-blue-50 px-4 py-2 text-blue-700 hover:bg-blue-100"
                >
                  检测报告
                </a>
              )}
              {cert && cert !== "NoCert" && (
                <a
                  href={`${IPFS_GATEWAY}${cert}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-green-50 px-4 py-2 text-green-700 hover:bg-green-100"
                >
                  资质证书
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TracePage() {
  const [params] = useSearchParams();
  const [currentUser] = useState(() => AuthService.getCurrentUser());
  const [traceData, setTraceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const productId = params.get("productId");

  const viewerRole = getViewerRole(currentUser);
  const viewerCopy = VIEWER_ROLE_COPY[viewerRole];
  const isRegulatorViewer = viewerRole === "regulator";
  const isSellerViewer = viewerRole === "seller";
  const canViewSensitiveIdentity = isRegulatorViewer || isSellerViewer;
  const canViewComplianceDetail = isRegulatorViewer || isSellerViewer;
  const canViewRegulatoryDetail = isRegulatorViewer;
  const canViewSellerOperations = isRegulatorViewer || isSellerViewer;

  useEffect(() => {
    let active = true;

    if (!productId) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError("");

    ProductService.getProductTrace(productId)
      .then((response) => {
        if (!active) return;
        setTraceData(response.data);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.message || requestError.message);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productId]);

  if (!productId) {
    return <LegacyTraceFallback params={params} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">电子设备追溯报告</h1>
            <p className="mt-2 text-slate-500">
              报告整合数据库记录、审计日志、IPFS 证据与链上状态信息。
            </p>
            <div className="mt-3 inline-flex rounded-full bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700">
              {viewerCopy.label}
            </div>
            <p className="mt-2 text-sm text-slate-500">{viewerCopy.description}</p>
          </div>
          <Link
            to="/home"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
          >
            {viewerCopy.homeLabel}
          </Link>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            正在加载追溯数据...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center">
            <div className="text-xl font-semibold text-rose-700">追溯数据加载失败</div>
            <div className="mt-2 text-slate-500">{error}</div>
          </div>
        )}

        {!loading && !error && traceData && (
          <>
            {traceData.riskProfile?.riskTags?.length > 0 && (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 shadow-sm">
                <div className="text-sm font-semibold uppercase tracking-wide text-amber-700">风险标记</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-amber-800">
                    风险等级：{RISK_LEVEL_LABELS[traceData.riskProfile.riskLevel] || traceData.riskProfile.riskLevel || "未提供"}
                  </span>
                  {traceData.riskProfile.riskTags.map((tag) =>
                    renderRiskPill(traceData.riskProfile.riskLevel, tag)
                  )}
                </div>
              </div>
            )}

            {traceData.recall?.recallStatus && (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-5 shadow-sm">
                <div className="text-sm font-semibold uppercase tracking-wide text-rose-700">召回公告</div>
                <div className="mt-2 text-xl font-bold text-rose-800">该电子产品已被召回。</div>
                <div className="mt-2 text-sm text-rose-700">原因：{traceData.recall.recallReason || "未提供"}</div>
                <div className="mt-1 text-sm text-rose-700">
                  批次：{traceData.recall.recallBatchNo || "未提供"} | 发布时间：
                  {formatDate(traceData.recall.recallNoticeAt)}
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-700 px-8 py-8 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm uppercase tracking-[0.25em] text-slate-300">追溯报告</div>
                    <h2 className="mt-3 text-4xl font-bold">{traceData.name}</h2>
                    <p className="mt-3 max-w-3xl text-slate-200">{traceData.description || "暂无描述"}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-300">商品 ID</div>
                    <div className="text-2xl font-bold">#{traceData.productId}</div>
                    {canViewRegulatoryDetail && (
                      <>
                        <div className="mt-3 text-sm text-slate-300">链上 ID</div>
                        <div className="text-lg font-semibold">{traceData.chainProductId}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className={`grid gap-6 p-8 ${canViewRegulatoryDetail ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
                <section className="space-y-4">
                  <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">设备身份</div>
                  <div className="space-y-4 rounded-2xl bg-slate-50 p-5">
                    <InfoRow label="类别" value={formatCategory(traceData.category)} />
                    <InfoRow label="品牌" value={traceData.brand} />
                    <InfoRow label="型号" value={traceData.model} />
                    <InfoRow
                      label="序列号 / IMEI"
                      value={
                        canViewSensitiveIdentity
                          ? traceData.serialNumberMasked
                          : maskValue(traceData.serialNumberMasked, 2, 2)
                      }
                    />
                    <InfoRow
                      label="批次号"
                      value={canViewSensitiveIdentity ? traceData.batchNo : maskValue(traceData.batchNo, 3, 2)}
                    />
                    <InfoRow label="生产日期" value={formatDate(traceData.manufactureDate)} />
                    <InfoRow label="质保截止" value={formatDate(traceData.warrantyUntil)} />
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">状态与合规</div>
                  <div className="space-y-4 rounded-2xl bg-slate-50 p-5">
                    <InfoRow label="是否二手" value={formatBoolean(traceData.isUsed)} />
                    <InfoRow label="是否翻新" value={formatBoolean(traceData.isRefurbished)} />
                    <InfoRow
                      label="电池健康度"
                      value={
                        traceData.batteryHealth !== null && traceData.batteryHealth !== undefined
                          ? `${traceData.batteryHealth}%`
                          : "未提供"
                      }
                    />
                    <InfoRow label="配件情况" value={traceData.accessoryStatus} />
                    <InfoRow
                      label="CCC 编号"
                      value={
                        canViewComplianceDetail
                          ? traceData.cccNumber
                          : maskValue(traceData.cccNumber, 3, 2)
                      }
                    />
                    <InfoRow label="能效等级" value={traceData.energyLevel} />
                    <InfoRow label="RoHS 状态" value={traceData.rohsStatus} />
                    {canViewComplianceDetail && (
                      <>
                        <InfoRow label="检测机构" value={traceData.compliance?.inspectionAgency} />
                        <InfoRow label="检测日期" value={formatDate(traceData.compliance?.inspectionDate)} />
                        <InfoRow label="检测结论" value={traceData.compliance?.inspectionConclusion} />
                        <InfoRow label="外观等级" value={traceData.compliance?.appearanceGrade} />
                        <InfoRow
                          label="功能测试"
                          value={formatBoolean(traceData.compliance?.functionalTestPassed)}
                        />
                        <InfoRow
                          label="已声明维修历史"
                          value={formatBoolean(traceData.compliance?.repairHistoryDeclared)}
                        />
                      </>
                    )}
                    <InfoRow
                      label="电池安全"
                      value={formatBoolean(traceData.compliance?.batterySafetyPassed)}
                    />
                    <InfoRow
                      label="充电安全"
                      value={formatBoolean(traceData.compliance?.chargerSafetyPassed)}
                    />
                  </div>
                </section>

                {canViewRegulatoryDetail && (
                  <section className="space-y-4">
                    <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      监管与链上状态
                    </div>
                    <div className="space-y-4 rounded-2xl bg-slate-50 p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">审核状态</span>
                        <StatusBadge
                          active={traceData.auditStatus === 1}
                          label={AUDIT_STATUS_LABELS[traceData.auditStatus] || "未知"}
                        />
                      </div>
                      <InfoRow label="审核说明" value={traceData.auditReason} />
                      <div className="space-y-2">
                        <div className="text-slate-500">结构化原因码</div>
                        <div className="flex flex-wrap justify-end gap-2">
                          {traceData.review?.reasonCodes?.length > 0 ? (
                            traceData.review.reasonCodes.map((code) => (
                              <span
                                key={code}
                                className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700"
                              >
                                {REASON_CODE_LABELS[code] || code}
                              </span>
                            ))
                          ) : (
                            <span className="text-right font-semibold text-slate-900">未提供</span>
                          )}
                        </div>
                      </div>
                      <InfoRow label="审核时间" value={formatDate(traceData.auditAt)} />
                      <InfoRow label="审核人" value={traceData.reviewer?.username} />
                      <InfoRow label="审核角色" value={traceData.reviewer?.role} />
                      <InfoRow label="价格" value={`${traceData.price} ETH`} />
                      <InfoRow label="当前库存" value={String(traceData.stock ?? "未提供")} />
                      <InfoRow label="链上来源" value={traceData.chain?.source} />
                      <InfoRow label="链上库存" value={String(traceData.chain?.stock ?? "未提供")} />
                      <InfoRow label="链上卖家钱包" value={traceData.chain?.sellerWallet} />
                      <InfoRow label="链上品牌" value={traceData.chainSummary?.brand} />
                      <InfoRow label="链上型号" value={traceData.chainSummary?.model} />
                      <InfoRow label="链上类别" value={traceData.chainSummary?.category} />
                      <InfoRow label="设备哈希" value={traceData.chainSummary?.deviceIdHash} />
                      <InfoRow label="CCC 哈希" value={traceData.chainSummary?.cccNumberHash} />
                      <InfoRow
                        label="风险等级"
                        value={
                          RISK_LEVEL_LABELS[traceData.chainSummary?.riskLevel] ||
                          String(traceData.chainSummary?.riskLevel ?? "未提供")
                        }
                      />
                      <InfoRow
                        label="链上召回标记"
                        value={traceData.chainSummary?.recallFlag ? "是" : "否"}
                      />
                      <InfoRow
                        label="卖家信誉分"
                        value={String(traceData.seller?.reputationScore ?? "未提供")}
                      />
                      <InfoRow
                        label="卖家是否拉黑"
                        value={traceData.seller?.isBlacklisted ? "是" : "否"}
                      />
                    </div>
                  </section>
                )}
              </div>

              <div className={`grid gap-6 px-8 pb-8 ${canViewSellerOperations ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
                <div className="rounded-2xl bg-slate-50 p-5">
                  <div className="mb-3 text-sm font-semibold text-slate-600">IPFS 证据材料</div>
                  <div className="flex flex-wrap gap-3">
                    {traceData.ipfsHash && traceData.ipfsHash !== "NoReport" && (
                      <a
                        href={`${IPFS_GATEWAY}${traceData.ipfsHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-blue-50 px-4 py-2 text-blue-700 hover:bg-blue-100"
                      >
                        检测报告
                      </a>
                    )}
                    {canViewComplianceDetail &&
                      traceData.qualificationHash &&
                      traceData.qualificationHash !== "NoCert" && (
                        <a
                          href={`${IPFS_GATEWAY}${traceData.qualificationHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-green-50 px-4 py-2 text-green-700 hover:bg-green-100"
                        >
                          资质证书
                        </a>
                      )}
                    {!traceData.ipfsHash && !traceData.qualificationHash && (
                      <span className="text-slate-500">暂无可用证据文件</span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-5">
                  <div className="mb-3 text-sm font-semibold text-slate-600">订单摘要</div>
                  <InfoRow label="关联订单数" value={String(traceData.metrics?.orderCount ?? 0)} />
                  <InfoRow label="投诉数量" value={String(traceData.metrics?.complaintCount ?? 0)} />
                  <InfoRow label="创建时间" value={formatDate(traceData.createdAt)} />
                  {canViewSellerOperations && (
                    <>
                      <InfoRow label="下架时间" value={formatDate(traceData.delistedAt)} />
                      <InfoRow label="下架原因" value={traceData.delistReason} />
                    </>
                  )}
                  <InfoRow label="召回状态" value={traceData.recall?.recallStatus ? "已召回" : "正常"} />
                </div>
              </div>
            </div>

            {canViewSellerOperations && (
              <div className="rounded-3xl bg-white p-8 shadow-xl">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-slate-900">关联订单</h3>
                  <p className="mt-2 text-slate-500">
                    {isRegulatorViewer
                      ? "展示商品流转、争议与履约过程的全量订单记录。"
                      : "展示与经营履约相关的订单与投诉处理信息。"}
                  </p>
                </div>

                {traceData.orders?.length > 0 ? (
                  <div className="space-y-4">
                    {traceData.orders.map((order) => (
                      <div key={order.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-lg font-semibold text-slate-900">订单 #{order.id}</div>
                            <div className="mt-1 text-sm text-slate-500">
                              买家：
                              {isRegulatorViewer
                                ? order.buyer?.username || "未知"
                                : maskValue(order.buyer?.username || "未知", 1, 1)}
                              {" | "}
                              创建时间：{formatDate(order.createdAt)}
                            </div>
                          </div>
                          <StatusBadge
                            active={order.status !== 3 && order.status !== 4}
                            label={ORDER_STATUS_LABELS[order.status] || "未知"}
                          />
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-4">
                          <InfoRow label="价格" value={`${order.price} ETH`} />
                          {isRegulatorViewer && (
                            <InfoRow label="链上订单 ID" value={String(order.onChainId || "未提供")} />
                          )}
                          <InfoRow label="物流状态" value={order.shippingStatus || "pending"} />
                          <InfoRow label="物流单号" value={order.trackingNumber} />
                          <InfoRow label="承运方" value={order.shippingCarrier} />
                          <InfoRow label="发货时间" value={formatDate(order.shippedAt)} />
                          <InfoRow label="评分" value={order.rating ? `${order.rating}/5` : "未提供"} />
                          <InfoRow label="更新时间" value={formatDate(order.updatedAt)} />
                        </div>

                        {(order.comment || order.complaintReason || order.rulingDetails || order.sellerResponse) && (
                          <div className="mt-4 space-y-2 text-sm text-slate-700">
                            {order.comment && (
                              <div>
                                <span className="text-slate-500">评价：</span>
                                {order.comment}
                              </div>
                            )}
                            {order.complaintReason && (
                              <div>
                                <span className="text-slate-500">投诉：</span>
                                {COMPLAINT_TYPE_LABELS[order.complaintType] || order.complaintType || "一般投诉"} / {order.complaintReason}
                              </div>
                            )}
                            {order.sellerResponse && (
                              <div>
                                <span className="text-slate-500">卖家答辩：</span>
                                {order.sellerResponse}
                              </div>
                            )}
                            {isRegulatorViewer && order.rulingDetails && (
                              <div>
                                <span className="text-slate-500">裁决：</span>
                                {order.rulingDetails}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500">暂无关联订单。</div>
                )}
              </div>
            )}

            {canViewRegulatoryDetail && (
              <div className="rounded-3xl bg-white p-8 shadow-xl">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-slate-900">审计时间线</h3>
                  <p className="mt-2 text-slate-500">将商品、订单与争议事件串联为完整追溯链路。</p>
                </div>

                {traceData.timeline?.length > 0 ? (
                  <div className="space-y-5">
                    {traceData.timeline.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="font-semibold text-slate-900">
                            {item.entityType} / {TIMELINE_ACTION_LABELS[item.action] || item.action}
                          </div>
                          <div className="text-sm text-slate-500">{formatDate(item.createdAt)}</div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-3">
                          <StatusBadge active={item.result === "SUCCESS"} label={item.result || "未知"} />
                          {item.txHash && (
                            <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">链上交易</span>
                          )}
                          {item.ipfsHash && (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">IPFS</span>
                          )}
                        </div>

                        <div className="mt-4 grid gap-2">
                          {parseDetails(item.details).map(([key, value]) => (
                            <div key={`${item.id}-${key}`} className="text-sm text-slate-700">
                              <span className="text-slate-500">{key}:</span> {String(value)}
                            </div>
                          ))}
                        </div>

                        {item.txHash && (
                          <div className="mt-4 break-all font-mono text-xs text-slate-600">txHash: {item.txHash}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500">暂无审计时间线记录。</div>
                )}
              </div>
            )}

            <div className="rounded-3xl bg-white p-8 shadow-xl">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-slate-900">售后记录</h3>
                <p className="mt-2 text-slate-500">
                  {canViewSellerOperations
                    ? "保修、维修、更换与退款记录共同补全设备生命周期。"
                    : "用于帮助买家判断该设备后续维护与质保情况。"}
                </p>
              </div>

              {traceData.afterSalesRecords?.length > 0 ? (
                <div className="space-y-4">
                  {traceData.afterSalesRecords.map((record) => (
                    <div key={record.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-semibold text-slate-900">
                          {AFTER_SALES_TYPE_LABELS[record.type] || record.type}
                        </div>
                        <div className="text-sm text-slate-500">{formatDate(record.createdAt)}</div>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                        {canViewSellerOperations && (
                          <InfoRow label="订单 ID" value={String(record.orderId)} />
                        )}
                        <InfoRow label="部件名称" value={record.componentName} />
                        <InfoRow label="处理结果" value={record.serviceResult} />
                        {canViewSellerOperations && (
                          <InfoRow label="记录人" value={record.creator?.username} />
                        )}
                      </div>
                      <div className="mt-3 text-sm text-slate-700">{record.description}</div>
                      {canViewSellerOperations && record.evidenceIpfsHash && (
                        <a
                          href={`${IPFS_GATEWAY}${record.evidenceIpfsHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block text-sm text-indigo-600 underline"
                        >
                          查看售后证据
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500">暂无售后记录。</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
