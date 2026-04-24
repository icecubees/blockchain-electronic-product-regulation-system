import React, { useEffect, useState } from "react";

import AuthService from "../services/auth.service";

function shortenAddress(address) {
  if (!address) {
    return "未绑定";
  }
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

async function requestCurrentWalletAccount() {
  if (!window.ethereum) {
    throw new Error("当前浏览器未检测到 MetaMask");
  }

  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  const account = accounts?.[0];
  if (!account) {
    throw new Error("未选择 MetaMask 账户");
  }
  return account;
}

export default function SellerWalletBinder({ accountRole = "seller", onWalletBound }) {
  const initialUser = AuthService.getCurrentUser();
  const [boundWallet, setBoundWallet] = useState(
    initialUser?.walletBound ? initialUser.ethAddress || "" : ""
  );
  const [currentWallet, setCurrentWallet] = useState("");
  const [binding, setBinding] = useState(false);
  const [message, setMessage] = useState("");
  const isSeller = accountRole === "seller";

  useEffect(() => {
    if (!window.ethereum?.request) {
      return;
    }

    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => setCurrentWallet(accounts?.[0] || ""))
      .catch(() => setCurrentWallet(""));
  }, []);

  const handleBindWallet = async () => {
    setBinding(true);
    setMessage("");

    try {
      const walletAddress = await requestCurrentWalletAccount();
      const response = await AuthService.bindWallet(walletAddress);
      setCurrentWallet(walletAddress);
      setBoundWallet(response.data?.user?.ethAddress || walletAddress);
      onWalletBound?.(response.data?.user?.ethAddress || walletAddress);
      setMessage("钱包绑定成功。");
    } catch (error) {
      setMessage(`绑定失败：${error.response?.data?.message || error.message}`);
    } finally {
      setBinding(false);
    }
  };

  const isSameWallet =
    boundWallet && currentWallet && boundWallet.toLowerCase() === currentWallet.toLowerCase();

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {isSeller ? "商家链上账户" : "买家链上账户"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {isSeller
              ? "发布商品前先绑定 MetaMask 钱包，链上商品归属将使用该地址。"
              : "购买和确认收货前先绑定 MetaMask 钱包，链上托管订单将使用该地址。"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleBindWallet}
          disabled={binding}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {binding ? "绑定中..." : "连接并绑定 MetaMask"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-md bg-white p-3 ring-1 ring-slate-200">
          <div className="text-slate-500">已绑定地址</div>
          <div className="mt-1 font-mono text-slate-900" title={boundWallet || ""}>
            {shortenAddress(boundWallet)}
          </div>
        </div>
        <div className="rounded-md bg-white p-3 ring-1 ring-slate-200">
          <div className="text-slate-500">当前 MetaMask</div>
          <div className="mt-1 font-mono text-slate-900" title={currentWallet || ""}>
            {shortenAddress(currentWallet)}
          </div>
        </div>
      </div>

      {currentWallet && boundWallet && (
        <div className={`mt-3 text-sm ${isSameWallet ? "text-emerald-700" : "text-amber-700"}`}>
          {isSameWallet ? "当前钱包与绑定地址一致。" : "当前钱包与绑定地址不一致，发布前建议重新绑定。"}
        </div>
      )}
      {message && <div className="mt-3 text-sm text-slate-700">{message}</div>}
    </section>
  );
}
