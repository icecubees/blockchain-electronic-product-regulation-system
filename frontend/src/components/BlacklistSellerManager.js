import React, { useState } from "react";

const DEFAULT_REASON = "监管复核通过，恢复卖家经营资格。";
const DEFAULT_RESTORE_SCORE = 20;

function SellerBlacklistCard({ seller, loading, onRestore }) {
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [restoredScore, setRestoredScore] = useState(DEFAULT_RESTORE_SCORE);

  const submitRestore = async () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      window.alert("请输入恢复原因。");
      return;
    }

    await onRestore(seller.id, trimmedReason, Number(restoredScore));
  };

  return (
    <div className="space-y-3 rounded-xl border border-rose-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-900">{seller.username}</div>
          <div className="mt-1 text-xs text-slate-500">卖家编号：{seller.id}</div>
        </div>
        <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
          黑名单中
        </span>
      </div>

      <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
        <div>
          <div className="text-slate-500">钱包地址</div>
          <div className="mt-1 break-all font-mono text-xs">{seller.ethAddress || "未提供"}</div>
        </div>
        <div>
          <div className="text-slate-500">当前信誉分</div>
          <div className="mt-1 font-semibold">{seller.reputationScore}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr,140px]">
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          className="w-full rounded border border-rose-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
          placeholder="请输入恢复该卖家的原因"
        />
        <div>
          <label className="mb-1 block text-xs text-slate-500">恢复后分数</label>
          <input
            type="number"
            min="0"
            value={restoredScore}
            onChange={(event) => setRestoredScore(event.target.value)}
            className="w-full rounded border border-rose-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
        </div>
      </div>

      <button
        onClick={submitRestore}
        disabled={loading}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        解除黑名单
      </button>
    </div>
  );
}

export default function BlacklistSellerManager({ sellers = [], loading, onRestore }) {
  return (
    <section className="rounded border-l-4 border-rose-400 bg-rose-50 p-4 shadow">
      <h2 className="mb-3 text-lg font-bold text-rose-800">黑名单卖家管理</h2>
      <p className="mb-4 text-sm text-rose-700">当前黑名单卖家数量：{sellers.length}</p>

      {sellers.length === 0 ? (
        <div className="rounded-xl border border-rose-100 bg-white p-4 text-sm text-slate-600">
          当前没有被列入黑名单的卖家。该区域会持续保留，便于监督方随时查看状态。
        </div>
      ) : (
        <div className="space-y-3">
          {sellers.map((seller) => (
            <SellerBlacklistCard
              key={seller.id}
              seller={seller}
              loading={loading}
              onRestore={onRestore}
            />
          ))}
        </div>
      )}
    </section>
  );
}
