import React, { useState } from "react";

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

const DEFAULT_SELLER_REASON = "资质审核通过。";
const DEFAULT_PRODUCT_APPROVE_REASON = "电子产品审核通过，允许上架。";
const DEFAULT_PRODUCT_REJECT_REASON = "电子产品审核不通过。";
const DEFAULT_RECALL_REASON = "存在潜在安全或合规召回风险。";

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

const QUALIFICATION_IPFS_FIELDS = new Set([
  "品牌授权材料",
  "维修资质材料",
  "二手设备经营资质",
]);

const REASON_CODE_LABELS = {
  missing_ccc_information: "缺少 CCC 信息",
  missing_device_identifier: "缺少设备唯一标识",
  undisclosed_refurbished_status: "未披露翻新状态",
  battery_safety_concern: "电池安全风险",
  report_model_mismatch: "报告型号不一致",
  suspected_counterfeit: "疑似假货",
};

function formatBoolean(value) {
  if (value === true) return "是";
  if (value === false) return "否";
  return "未提供";
}

function SellerReviewCard({ seller, loading, onSubmit }) {
  const [reason, setReason] = useState(DEFAULT_SELLER_REASON);
  const qualificationItems = [
    ["资质类型", seller.qualificationType || "未提供"],
    ["品牌授权材料", seller.brandAuthorizationHash || "未提供"],
    ["维修资质材料", seller.repairQualificationHash || "未提供"],
    ["二手设备经营资质", seller.usedDeviceQualificationHash || "未提供"],
  ];

  const submit = async (action) => {
    const trimmed = reason.trim();
    if (!trimmed) {
      window.alert("请输入审核理由。");
      return;
    }

    await onSubmit(seller.id, action, trimmed);
  };

  return (
    <div className="space-y-3 rounded border border-blue-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-gray-800">{seller.username}</div>
          <div className="text-xs text-gray-500">
            提交时间：{seller.createdAt ? new Date(seller.createdAt).toLocaleString() : "未知"}
          </div>
        </div>
        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">待处理</span>
      </div>

      <div className="rounded border border-blue-100 bg-blue-50 p-3 text-xs text-slate-700">
        <div className="mb-2 font-semibold text-blue-900">电子产品经营资质摘要</div>
        <div className="grid gap-2 md:grid-cols-2">
          {qualificationItems.map(([label, value]) => (
            <div key={label}>
              <span className="text-slate-500">{label}：</span>
              {QUALIFICATION_IPFS_FIELDS.has(label) && value !== "未提供" ? (
                <a
                  href={`${IPFS_GATEWAY}${value}`}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-medium text-indigo-700 underline"
                >
                  {value}
                </a>
              ) : (
                <span className="break-all font-medium text-slate-800">{value}</span>
              )}
            </div>
          ))}
        </div>
        {seller.qualificationNotes ? (
          <div className="mt-2">
            <span className="text-slate-500">补充说明：</span>
            <span className="font-medium text-slate-800">{seller.qualificationNotes}</span>
          </div>
        ) : null}
      </div>

      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
        className="w-full rounded border border-blue-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        placeholder="此内容将写入审计日志"
      />

      <div className="flex gap-2">
        <button
          onClick={() => submit("approve")}
          disabled={loading}
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
        >
          通过
        </button>
        <button
          onClick={() => submit("reject")}
          disabled={loading}
          className="rounded bg-slate-600 px-3 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
        >
          驳回
        </button>
      </div>
    </div>
  );
}

function ReasonCodeChips({ selectedCodes, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(REASON_CODE_LABELS).map(([code, label]) => {
        const active = selectedCodes.includes(code);
        return (
          <button
            key={code}
            type="button"
            onClick={() => onToggle(code)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              active
                ? "border-indigo-300 bg-indigo-100 text-indigo-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ProductReviewCard({ product, loading, onSubmit, onForceDelist, onRecall }) {
  const [approveReason, setApproveReason] = useState(DEFAULT_PRODUCT_APPROVE_REASON);
  const [rejectReason, setRejectReason] = useState(DEFAULT_PRODUCT_REJECT_REASON);
  const [selectedReasonCodes, setSelectedReasonCodes] = useState([]);
  const [recallReason, setRecallReason] = useState(DEFAULT_RECALL_REASON);
  const [recallBatchNo, setRecallBatchNo] = useState(product.batchNo || "");

  const missingReviewItems = product.missingReviewItems || [];

  const toggleReasonCode = (code) => {
    setSelectedReasonCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    );
  };

  const submit = async (decision, rawReason) => {
    const trimmed = rawReason.trim();
    if (!trimmed) {
      window.alert("请输入审核理由。");
      return;
    }

    await onSubmit(product.id, decision, trimmed, selectedReasonCodes);
  };

  const submitRecall = async () => {
    const trimmedReason = recallReason.trim();
    if (!trimmedReason) {
      window.alert("请输入召回原因。");
      return;
    }

    await onRecall(product.id, trimmedReason, recallBatchNo.trim());
  };

  return (
    <div className="space-y-4 rounded border border-yellow-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-gray-800">{product.name}</div>
          <div className="mt-1 text-sm text-gray-500">{product.description || "暂无描述"}</div>
          <div className="mt-2 text-xs text-gray-500">
            卖家：{product.seller?.username || "未知"} | 价格：{product.price} ETH | 库存：{product.stock}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
            <span className="rounded bg-slate-100 px-2 py-1">
              {CATEGORY_LABELS[product.category] || product.category || "未分类"}
            </span>
            {product.brand ? <span className="rounded bg-slate-100 px-2 py-1">{product.brand}</span> : null}
            {product.model ? <span className="rounded bg-slate-100 px-2 py-1">{product.model}</span> : null}
            {product.serialNumber ? (
              <span className="rounded bg-slate-100 px-2 py-1">SN: {product.serialNumber}</span>
            ) : null}
            {product.cccNumber ? (
              <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">CCC: {product.cccNumber}</span>
            ) : (
              <span className="rounded bg-rose-100 px-2 py-1 text-rose-700">缺少 CCC</span>
            )}
            {product.isUsed ? <span className="rounded bg-amber-100 px-2 py-1 text-amber-700">二手</span> : null}
            {product.isRefurbished ? (
              <span className="rounded bg-indigo-100 px-2 py-1 text-indigo-700">翻新</span>
            ) : null}
          </div>
        </div>
        <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-700">待审核</span>
      </div>

      {missingReviewItems.length > 0 && (
        <div className="rounded border border-rose-200 bg-rose-50 p-3">
          <div className="text-sm font-semibold text-rose-700">缺失审核项</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-700">
            {missingReviewItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-2 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 md:grid-cols-2">
        <div>检测机构：{product.inspectionAgency || "未提供"}</div>
        <div>检测结论：{product.inspectionConclusion || "未提供"}</div>
        <div>电池安全：{formatBoolean(product.batterySafetyPassed)}</div>
        <div>充电安全：{formatBoolean(product.chargerSafetyPassed)}</div>
        <div>外观等级：{product.appearanceGrade || "未提供"}</div>
        <div>已声明维修历史：{formatBoolean(product.repairHistoryDeclared)}</div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-slate-700">快捷原因码</div>
        <ReasonCodeChips selectedCodes={selectedReasonCodes} onToggle={toggleReasonCode} />
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {product.ipfsHash && product.ipfsHash !== "NoReport" && (
          <a
            href={`${IPFS_GATEWAY}${product.ipfsHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 hover:underline"
          >
            查看检测报告
          </a>
        )}
        {product.qualificationHash && product.qualificationHash !== "NoCert" && (
          <a
            href={`${IPFS_GATEWAY}${product.qualificationHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-green-600 hover:underline"
          >
            查看资质材料
          </a>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm font-medium text-emerald-700">通过理由</div>
          <textarea
            value={approveReason}
            onChange={(event) => setApproveReason(event.target.value)}
            rows={3}
            className="w-full rounded border border-emerald-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <button
            onClick={() => submit(1, approveReason)}
            disabled={loading}
            className="rounded bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            通过
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-amber-700">驳回理由</div>
          <textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            rows={3}
            className="w-full rounded border border-amber-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
          <div className="flex gap-2">
            <button
              onClick={() => submit(0, rejectReason)}
              disabled={loading}
              className="rounded bg-amber-600 px-3 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-60"
            >
              驳回
            </button>
            <button
              onClick={() => onForceDelist(product)}
              disabled={loading}
              className="rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
            >
              强制下架
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded border border-rose-200 bg-rose-50 p-3 md:grid-cols-[1fr,160px,120px]">
        <textarea
          value={recallReason}
          onChange={(event) => setRecallReason(event.target.value)}
          rows={2}
          className="w-full rounded border border-rose-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
          placeholder="召回原因"
        />
        <input
          value={recallBatchNo}
          onChange={(event) => setRecallBatchNo(event.target.value)}
          className="rounded border border-rose-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
          placeholder="召回批次"
        />
        <button
          onClick={submitRecall}
          disabled={loading}
          className="rounded bg-rose-600 px-3 py-2 text-sm text-white hover:bg-rose-700 disabled:opacity-60"
        >
          执行召回
        </button>
      </div>
    </div>
  );
}

export default function RegulatorReviewQueues({
  pendingSellers,
  pendingProducts,
  loading,
  onSellerReview,
  onProductReview,
  onForceDelist,
  onRecall,
}) {
  if (pendingSellers.length === 0 && pendingProducts.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-slate-600">
        当前没有待处理卖家申请，也没有待审电子产品。
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <section className="rounded border-l-4 border-blue-400 bg-blue-50 p-4 shadow">
        <h2 className="mb-3 text-lg font-bold text-blue-800">待审核卖家（{pendingSellers.length}）</h2>
        {pendingSellers.length === 0 ? (
          <div className="rounded border border-blue-100 bg-white p-3 text-sm text-slate-600">暂无待审卖家。</div>
        ) : (
          <div className="space-y-3">
            {pendingSellers.map((seller) => (
              <SellerReviewCard
                key={seller.id}
                seller={seller}
                loading={loading}
                onSubmit={onSellerReview}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded border-l-4 border-yellow-400 bg-yellow-50 p-4 shadow">
        <h2 className="mb-3 text-lg font-bold text-yellow-800">待审电子产品（{pendingProducts.length}）</h2>
        {pendingProducts.length === 0 ? (
          <div className="rounded border border-yellow-100 bg-white p-3 text-sm text-slate-600">暂无待审商品。</div>
        ) : (
          <div className="space-y-3">
            {pendingProducts.map((product) => (
              <ProductReviewCard
                key={product.id}
                product={product}
                loading={loading}
                onSubmit={onProductReview}
                onForceDelist={onForceDelist}
                onRecall={onRecall}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
