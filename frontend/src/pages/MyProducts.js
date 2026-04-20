import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ProductService from "../services/product.service";
import AuthService from "../services/auth.service";
import FileService from "../services/file.service";

const CATEGORY_OPTIONS = [
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

const ACCESSORY_OPTIONS = [
  { value: "full", label: "配件齐全" },
  { value: "partial", label: "部分缺失" },
  { value: "none", label: "无配件" },
];

const INSPECTION_CONCLUSIONS = [
  { value: "pass", label: "通过" },
  { value: "conditional_pass", label: "附条件通过" },
  { value: "fail", label: "不通过" },
];

const APPEARANCE_GRADES = [
  { value: "S", label: "S 级" },
  { value: "A", label: "A 级" },
  { value: "B", label: "B 级" },
  { value: "C", label: "C 级" },
];

const INITIAL_RESUBMIT_FORM = {
  name: "",
  brand: "",
  model: "",
  category: "mobile_phone",
  serialNumber: "",
  batchNo: "",
  manufactureDate: "",
  warrantyUntil: "",
  isUsed: false,
  isRefurbished: false,
  batteryHealth: "",
  accessoryStatus: "full",
  cccNumber: "",
  energyLevel: "",
  rohsStatus: "",
  inspectionAgency: "",
  inspectionDate: "",
  inspectionConclusion: "pass",
  batterySafetyPassed: false,
  chargerSafetyPassed: false,
  appearanceGrade: "A",
  functionalTestPassed: true,
  repairHistoryDeclared: false,
  price: "",
  description: "",
  ipfsHash: "",
  qualificationHash: "",
  stock: "",
};

function getCategoryLabel(category) {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label || category || "未分类";
}

function statusLabel(product) {
  if (product.recallStatus) return "已召回";
  if (product.auditStatus === 0) return "待审核";
  if (product.auditStatus === 2) return "已驳回 / 已下架";
  if (product.stock <= 0) return "已售罄";
  return "在售中";
}

function statusClass(product) {
  if (product.recallStatus) return "bg-rose-100 text-rose-700";
  if (product.auditStatus === 0) return "bg-amber-100 text-amber-700";
  if (product.auditStatus === 2) return "bg-rose-100 text-rose-700";
  if (product.stock <= 0) return "bg-slate-100 text-slate-700";
  return "bg-emerald-100 text-emerald-700";
}

export default function MyProducts() {
  const [products, setProducts] = useState([]);
  const [sellerInfo, setSellerInfo] = useState({ score: 60, isBlacklisted: false });
  const [loading, setLoading] = useState(false);
  const [restockInputs, setRestockInputs] = useState({});
  const [delistReasons, setDelistReasons] = useState({});
  const [editingProduct, setEditingProduct] = useState(null);
  const [resubmitForm, setResubmitForm] = useState(INITIAL_RESUBMIT_FORM);
  const [resubmitFiles, setResubmitFiles] = useState({
    reportFile: null,
    qualificationFile: null,
  });
  const [showAdvancedHashes, setShowAdvancedHashes] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const user = AuthService.getCurrentUser();
    if (!user || user.role !== "seller") {
      navigate("/home");
      return;
    }

    if (user.reputationScore !== undefined) {
      setSellerInfo({
        score: user.reputationScore,
        isBlacklisted: user.isBlacklisted,
      });
    }

    loadMyProducts();
  }, [navigate]);

  const loadMyProducts = () => {
    ProductService.getMyProducts().then(
      (res) => setProducts(res.data),
      (err) => console.error(err)
    );
  };

  const handleDelist = async (product) => {
    const reason = String(delistReasons[product.id] || "").trim();
    if (!reason) {
      window.alert("请输入下架原因。");
      return;
    }

    setLoading(true);
    try {
      await ProductService.delistProduct(product.id, reason);
      window.alert("商品下架成功。");
      loadMyProducts();
    } catch (err) {
      window.alert(`下架失败：${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestock = async (product) => {
    const amount = Number(restockInputs[product.id] || 0);
    if (!Number.isInteger(amount) || amount <= 0) {
      window.alert("请输入有效的补货数量。");
      return;
    }

    setLoading(true);
    try {
      await ProductService.restockProduct(product.id, amount);
      window.alert("补货成功。");
      setRestockInputs((prev) => ({ ...prev, [product.id]: "" }));
      loadMyProducts();
    } catch (err) {
      window.alert(`补货失败：${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateResubmitForm = (field, value) => {
    setResubmitForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const openResubmit = (product) => {
    setEditingProduct(product);
    setResubmitFiles({
      reportFile: null,
      qualificationFile: null,
    });
    setShowAdvancedHashes(false);
    setResubmitForm({
      name: product.name || "",
      brand: product.brand || "",
      model: product.model || "",
      category: product.category || "mobile_phone",
      serialNumber: product.serialNumber || "",
      batchNo: product.batchNo || "",
      manufactureDate: product.manufactureDate ? String(product.manufactureDate).slice(0, 10) : "",
      warrantyUntil: product.warrantyUntil ? String(product.warrantyUntil).slice(0, 10) : "",
      isUsed: Boolean(product.isUsed),
      isRefurbished: Boolean(product.isRefurbished),
      batteryHealth: product.batteryHealth ?? "",
      accessoryStatus: product.accessoryStatus || "full",
      cccNumber: product.cccNumber || "",
      energyLevel: product.energyLevel || "",
      rohsStatus: product.rohsStatus || "",
      inspectionAgency: product.inspectionAgency || "",
      inspectionDate: product.inspectionDate ? String(product.inspectionDate).slice(0, 10) : "",
      inspectionConclusion: product.inspectionConclusion || "pass",
      batterySafetyPassed: Boolean(product.batterySafetyPassed),
      chargerSafetyPassed: Boolean(product.chargerSafetyPassed),
      appearanceGrade: product.appearanceGrade || "A",
      functionalTestPassed:
        product.functionalTestPassed === null || product.functionalTestPassed === undefined
          ? true
          : Boolean(product.functionalTestPassed),
      repairHistoryDeclared: Boolean(product.repairHistoryDeclared),
      price: product.price ?? "",
      description: product.description || "",
      ipfsHash: product.ipfsHash || "",
      qualificationHash: product.qualificationHash || "",
      stock: product.stock ?? "",
    });
  };

  const handleResubmit = async () => {
    if (!editingProduct) return;

    setLoading(true);
    try {
      let nextIpfsHash = resubmitForm.ipfsHash;
      let nextQualificationHash = resubmitForm.qualificationHash;

      if (resubmitFiles.reportFile) {
        const uploadResponse = await FileService.uploadProductReport(resubmitFiles.reportFile);
        nextIpfsHash = uploadResponse.data.ipfsHash;
      }

      if (resubmitFiles.qualificationFile) {
        const uploadResponse = await FileService.uploadProductCertificate(
          resubmitFiles.qualificationFile
        );
        nextQualificationHash = uploadResponse.data.ipfsHash;
      }

      const payload = {
        productId: editingProduct.id,
        ...resubmitForm,
        ipfsHash: nextIpfsHash,
        qualificationHash: nextQualificationHash,
      };

      const response = await ProductService.resubmitProduct(payload);
      window.alert(response.data?.message || "商品重新提交成功。");
      setEditingProduct(null);
      setResubmitFiles({
        reportFile: null,
        qualificationFile: null,
      });
      setShowAdvancedHashes(false);
      loadMyProducts();
    } catch (err) {
      window.alert(`重新提交失败：${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div
            className={`flex items-center justify-between rounded-lg p-6 text-white shadow-lg ${
              sellerInfo.isBlacklisted ? "bg-red-600" : "bg-gradient-to-r from-indigo-600 to-blue-500"
            }`}
          >
            <div>
              <div className="text-sm font-medium uppercase tracking-wider opacity-90">卖家信誉分</div>
              <div className="mt-1 text-5xl font-bold">{sellerInfo.score}</div>
              <div className="mt-2 inline-block rounded-full bg-white bg-opacity-20 px-3 py-1 text-xs">
                {sellerInfo.isBlacklisted ? "账号受限" : "账号正常"}
              </div>
            </div>
            <div className="text-6xl opacity-20">R</div>
          </div>

          <div className="flex flex-col justify-center rounded-lg border border-gray-100 bg-white p-6 shadow">
            <h3 className="mb-2 font-bold text-gray-700">当前评分规则</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>完成订单：+1</li>
              <li>投诉败诉：-20</li>
              <li>信誉分低于 0 将触发黑名单</li>
            </ul>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-800">商品管理</h1>
          <div className="space-x-3">
            <button
              onClick={() => navigate("/add")}
              disabled={sellerInfo.isBlacklisted}
              className={`rounded px-4 py-2 text-white shadow ${
                sellerInfo.isBlacklisted ? "cursor-not-allowed bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              发布新商品
            </button>
            <button
              onClick={() => navigate("/home")}
              className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              返回首页
            </button>
          </div>
        </div>

        {loading && <div className="mb-4 text-sm font-medium text-indigo-600">正在处理请求...</div>}

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  商品
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  价格
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  库存
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-6 py-4 align-top">
                    <div className="font-medium text-gray-900">{product.name}</div>
                    <div className="mt-1 text-xs text-gray-500">{product.description || "暂无描述"}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                      <span className="rounded bg-slate-100 px-2 py-1">{getCategoryLabel(product.category)}</span>
                      {product.brand ? <span className="rounded bg-slate-100 px-2 py-1">{product.brand}</span> : null}
                      {product.model ? <span className="rounded bg-slate-100 px-2 py-1">{product.model}</span> : null}
                      {product.isUsed ? <span className="rounded bg-amber-100 px-2 py-1 text-amber-700">二手</span> : null}
                      {product.isRefurbished ? (
                        <span className="rounded bg-indigo-100 px-2 py-1 text-indigo-700">翻新</span>
                      ) : null}
                      {product.recallStatus ? (
                        <span className="rounded bg-rose-100 px-2 py-1 text-rose-700">已召回</span>
                      ) : null}
                    </div>
                    {product.auditReason ? (
                      <div className="mt-2 inline-block rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">
                        审核说明：{product.auditReason}
                      </div>
                    ) : null}
                    {product.recallStatus ? (
                      <div className="mt-2 rounded bg-rose-50 px-2 py-2 text-xs text-rose-700">
                        召回说明：{product.recallReason || "未提供召回原因"}
                        {product.recallBatchNo ? ` | 批次：${product.recallBatchNo}` : ""}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 align-top text-gray-700">{product.price} ETH</td>
                  <td className="px-6 py-4 align-top text-gray-700">{product.stock}</td>
                  <td className="px-6 py-4 align-top">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(product)}`}>
                      {statusLabel(product)}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="min-w-[260px] space-y-3">
                      {product.auditStatus === 1 ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            placeholder="补货数量"
                            value={restockInputs[product.id] || ""}
                            onChange={(event) =>
                              setRestockInputs((prev) => ({
                                ...prev,
                                [product.id]: event.target.value,
                              }))
                            }
                            className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                          <button
                            onClick={() => handleRestock(product)}
                            className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
                            disabled={sellerInfo.isBlacklisted || product.recallStatus}
                          >
                            补货
                          </button>
                        </div>
                      ) : null}

                      {product.auditStatus === 2 ? (
                        <button
                          onClick={() => openResubmit(product)}
                          className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700"
                          disabled={sellerInfo.isBlacklisted || product.recallStatus}
                        >
                          编辑并重新提交
                        </button>
                      ) : null}

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="下架原因"
                          value={delistReasons[product.id] || ""}
                          onChange={(event) =>
                            setDelistReasons((prev) => ({
                              ...prev,
                              [product.id]: event.target.value,
                            }))
                          }
                          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => handleDelist(product)}
                          disabled={product.stock <= 0 || product.auditStatus === 2 || product.recallStatus}
                          className={`rounded px-3 py-1 text-xs text-white ${
                            product.stock <= 0 || product.auditStatus === 2 || product.recallStatus
                              ? "cursor-not-allowed bg-gray-300"
                              : "bg-red-600 hover:bg-red-700"
                          }`}
                        >
                          下架
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}

              {products.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-500">
                    暂无已发布商品。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditingProduct(null)}
        >
          <div
            className="w-full max-w-4xl space-y-4 rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-800">编辑并重新提交商品</h2>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-600">商品名称</label>
                <input
                  value={resubmitForm.name}
                  onChange={(event) => updateResubmitForm("name", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">商品类别</label>
                <select
                  value={resubmitForm.category}
                  onChange={(event) => updateResubmitForm("category", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">品牌</label>
                <input
                  value={resubmitForm.brand}
                  onChange={(event) => updateResubmitForm("brand", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">型号</label>
                <input
                  value={resubmitForm.model}
                  onChange={(event) => updateResubmitForm("model", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">价格（ETH）</label>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={resubmitForm.price}
                  onChange={(event) => updateResubmitForm("price", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">库存</label>
                <input
                  type="number"
                  min="1"
                  value={resubmitForm.stock}
                  onChange={(event) => updateResubmitForm("stock", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">序列号 / IMEI</label>
                <input
                  value={resubmitForm.serialNumber}
                  onChange={(event) => updateResubmitForm("serialNumber", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">批次号</label>
                <input
                  value={resubmitForm.batchNo}
                  onChange={(event) => updateResubmitForm("batchNo", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">生产日期</label>
                <input
                  type="date"
                  value={resubmitForm.manufactureDate}
                  onChange={(event) => updateResubmitForm("manufactureDate", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">质保截止日期</label>
                <input
                  type="date"
                  value={resubmitForm.warrantyUntil}
                  onChange={(event) => updateResubmitForm("warrantyUntil", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">电池健康度（%）</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={resubmitForm.batteryHealth}
                  onChange={(event) => updateResubmitForm("batteryHealth", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">配件情况</label>
                <select
                  value={resubmitForm.accessoryStatus}
                  onChange={(event) => updateResubmitForm("accessoryStatus", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  {ACCESSORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">CCC 编号</label>
                <input
                  value={resubmitForm.cccNumber}
                  onChange={(event) => updateResubmitForm("cccNumber", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">检测机构</label>
                <input
                  value={resubmitForm.inspectionAgency}
                  onChange={(event) => updateResubmitForm("inspectionAgency", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">检测日期</label>
                <input
                  type="date"
                  value={resubmitForm.inspectionDate}
                  onChange={(event) => updateResubmitForm("inspectionDate", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">检测结论</label>
                <select
                  value={resubmitForm.inspectionConclusion}
                  onChange={(event) => updateResubmitForm("inspectionConclusion", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  {INSPECTION_CONCLUSIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded border border-gray-200 p-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={resubmitForm.isUsed}
                  onChange={(event) => updateResubmitForm("isUsed", event.target.checked)}
                />
                是否二手
              </label>
              <label className="flex items-center gap-3 rounded border border-gray-200 p-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={resubmitForm.isRefurbished}
                  onChange={(event) => updateResubmitForm("isRefurbished", event.target.checked)}
                />
                是否翻新
              </label>
              <label className="flex items-center gap-3 rounded border border-gray-200 p-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={resubmitForm.batterySafetyPassed}
                  onChange={(event) => updateResubmitForm("batterySafetyPassed", event.target.checked)}
                />
                电池安全检测通过
              </label>
              <label className="flex items-center gap-3 rounded border border-gray-200 p-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={resubmitForm.chargerSafetyPassed}
                  onChange={(event) => updateResubmitForm("chargerSafetyPassed", event.target.checked)}
                />
                充电安全检测通过
              </label>
              <label className="flex items-center gap-3 rounded border border-gray-200 p-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={resubmitForm.functionalTestPassed}
                  onChange={(event) => updateResubmitForm("functionalTestPassed", event.target.checked)}
                />
                功能测试通过
              </label>
              <label className="flex items-center gap-3 rounded border border-gray-200 p-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={resubmitForm.repairHistoryDeclared}
                  onChange={(event) => updateResubmitForm("repairHistoryDeclared", event.target.checked)}
                />
                已声明维修历史
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-600">外观等级</label>
                <select
                  value={resubmitForm.appearanceGrade}
                  onChange={(event) => updateResubmitForm("appearanceGrade", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  {APPEARANCE_GRADES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">能效等级</label>
                <input
                  value={resubmitForm.energyLevel}
                  onChange={(event) => updateResubmitForm("energyLevel", event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">RoHS 状态</label>
              <input
                value={resubmitForm.rohsStatus}
                onChange={(event) => updateResubmitForm("rohsStatus", event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">商品描述</label>
              <textarea
                rows={4}
                value={resubmitForm.description}
                onChange={(event) => updateResubmitForm("description", event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-indigo-900">重新上传合规文件</div>
                  <div className="mt-1 text-xs text-indigo-700">
                    推荐直接上传新的检测报告和资质文件，系统会自动替换 IPFS 哈希。
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedHashes((prev) => !prev)}
                  className="rounded border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  {showAdvancedHashes ? "隐藏高级哈希选项" : "显示高级哈希选项"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-gray-600">重新上传检测报告（PDF）</label>
                  <input
                    aria-label="重新上传检测报告"
                    type="file"
                    accept="application/pdf"
                    onChange={(event) =>
                      setResubmitFiles((prev) => ({
                        ...prev,
                        reportFile: event.target.files?.[0] || null,
                      }))
                    }
                    className="block w-full text-sm text-slate-500 file:mr-4 file:rounded file:border-0 file:bg-indigo-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-200"
                  />
                  <div className="mt-2 text-xs text-gray-500">
                    {resubmitFiles.reportFile
                      ? `待上传文件：${resubmitFiles.reportFile.name}`
                      : `当前哈希：${resubmitForm.ipfsHash || "未提供"}`}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">重新上传资质文件（PDF）</label>
                  <input
                    aria-label="重新上传资质文件"
                    type="file"
                    accept="application/pdf"
                    onChange={(event) =>
                      setResubmitFiles((prev) => ({
                        ...prev,
                        qualificationFile: event.target.files?.[0] || null,
                      }))
                    }
                    className="block w-full text-sm text-slate-500 file:mr-4 file:rounded file:border-0 file:bg-indigo-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-200"
                  />
                  <div className="mt-2 text-xs text-gray-500">
                    {resubmitFiles.qualificationFile
                      ? `待上传文件：${resubmitFiles.qualificationFile.name}`
                      : `当前哈希：${resubmitForm.qualificationHash || "未提供"}`}
                  </div>
                </div>
              </div>

              {showAdvancedHashes ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">高级选项：检测报告 IPFS 哈希</label>
                    <input
                      value={resubmitForm.ipfsHash}
                      onChange={(event) => updateResubmitForm("ipfsHash", event.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">高级选项：资质材料 IPFS 哈希</label>
                    <input
                      value={resubmitForm.qualificationHash}
                      onChange={(event) => updateResubmitForm("qualificationHash", event.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              未重新上传的文件会继续沿用当前 IPFS 哈希，确保旧的重提接口仍然兼容。
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setResubmitFiles({
                    reportFile: null,
                    qualificationFile: null,
                  });
                  setShowAdvancedHashes(false);
                }}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleResubmit}
                className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                disabled={loading}
              >
                确认重新提交
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
