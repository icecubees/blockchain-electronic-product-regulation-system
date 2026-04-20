import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ProductService from "../services/product.service";
import FileService from "../services/file.service";
import AuthService from "../services/auth.service";

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

const INITIAL_FORM = {
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
  stock: 1,
  description: "",
};

const AddProduct = () => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [fileReport, setFileReport] = useState(null);
  const [fileCert, setFileCert] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const user = AuthService.getCurrentUser();
    if (!user || user.role !== "seller") {
      navigate("/home");
    }
  }, [navigate]);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (!fileReport || !fileCert) {
        throw new Error("请同时上传检测报告和资质材料。");
      }

      setMessage("正在上传检测报告...");
      const reportUpload = await FileService.uploadProductReport(fileReport);

      setMessage("正在上传资质材料...");
      const certUpload = await FileService.uploadProductCertificate(fileCert);

      setMessage("正在提交商品审核...");
      const payload = {
        ...form,
        ipfsHash: reportUpload.data.ipfsHash,
        qualificationHash: certUpload.data.ipfsHash,
      };
      const response = await ProductService.addProduct(payload, fileReport);

      setMessage(response.data.message || "商品提交成功。");

      setTimeout(() => {
        navigate("/my-products");
      }, 1200);
    } catch (error) {
      const responseMessage = error.response?.data?.message || error.message;
      setMessage(`提交失败：${responseMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">发布电子产品</h2>

        <div className="mt-8 rounded-lg bg-white px-6 py-8 shadow">
          <form onSubmit={handleSubmit} className="space-y-8">
            <section className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">基础信息</h3>
                <p className="text-sm text-gray-500">
                  保留原有发布流程，同时补充电子产品特有的设备身份与合规信息。
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">商品名称</label>
                  <input
                    type="text"
                    required
                    aria-label="商品名称"
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">商品类别</label>
                  <select
                    value={form.category}
                    onChange={(event) => updateField("category", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">品牌</label>
                  <input
                    type="text"
                    aria-label="品牌"
                    value={form.brand}
                    onChange={(event) => updateField("brand", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">型号</label>
                  <input
                    type="text"
                    aria-label="型号"
                    value={form.model}
                    onChange={(event) => updateField("model", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">价格（ETH）</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    aria-label="价格（ETH）"
                    value={form.price}
                    onChange={(event) => updateField("price", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">库存</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.stock}
                    onChange={(event) => updateField("stock", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">设备身份信息</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">序列号 / IMEI</label>
                  <input
                    type="text"
                    aria-label="序列号 / IMEI"
                    value={form.serialNumber}
                    onChange={(event) => updateField("serialNumber", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">批次号</label>
                  <input
                    type="text"
                    value={form.batchNo}
                    onChange={(event) => updateField("batchNo", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">生产日期</label>
                  <input
                    type="date"
                    value={form.manufactureDate}
                    onChange={(event) => updateField("manufactureDate", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">质保截止日期</label>
                  <input
                    type="date"
                    value={form.warrantyUntil}
                    onChange={(event) => updateField("warrantyUntil", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">设备状态声明</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded border border-gray-200 p-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.isUsed}
                    onChange={(event) => updateField("isUsed", event.target.checked)}
                  />
                  是否二手
                </label>
                <label className="flex items-center gap-3 rounded border border-gray-200 p-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.isRefurbished}
                    onChange={(event) => updateField("isRefurbished", event.target.checked)}
                  />
                  是否翻新
                </label>
                <div>
                  <label className="block text-sm font-medium text-gray-700">电池健康度（%）</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.batteryHealth}
                    onChange={(event) => updateField("batteryHealth", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">配件情况</label>
                  <select
                    value={form.accessoryStatus}
                    onChange={(event) => updateField("accessoryStatus", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  >
                    {ACCESSORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">合规信息摘要</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">CCC 编号</label>
                  <input
                    type="text"
                    aria-label="CCC 编号"
                    value={form.cccNumber}
                    onChange={(event) => updateField("cccNumber", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">能效等级</label>
                  <input
                    type="text"
                    value={form.energyLevel}
                    onChange={(event) => updateField("energyLevel", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">RoHS 状态</label>
                  <input
                    type="text"
                    value={form.rohsStatus}
                    onChange={(event) => updateField("rohsStatus", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">检测机构</label>
                  <input
                    type="text"
                    value={form.inspectionAgency}
                    onChange={(event) => updateField("inspectionAgency", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">检测日期</label>
                  <input
                    type="date"
                    value={form.inspectionDate}
                    onChange={(event) => updateField("inspectionDate", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">检测结论</label>
                  <select
                    value={form.inspectionConclusion}
                    onChange={(event) => updateField("inspectionConclusion", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  >
                    {INSPECTION_CONCLUSIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">外观等级</label>
                  <select
                    value={form.appearanceGrade}
                    onChange={(event) => updateField("appearanceGrade", event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                  >
                    {APPEARANCE_GRADES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-3 rounded border border-gray-200 p-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.batterySafetyPassed}
                    onChange={(event) => updateField("batterySafetyPassed", event.target.checked)}
                  />
                  电池安全检测通过
                </label>
                <label className="flex items-center gap-3 rounded border border-gray-200 p-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.chargerSafetyPassed}
                    onChange={(event) => updateField("chargerSafetyPassed", event.target.checked)}
                  />
                  充电安全检测通过
                </label>
                <label className="flex items-center gap-3 rounded border border-gray-200 p-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.functionalTestPassed}
                    onChange={(event) => updateField("functionalTestPassed", event.target.checked)}
                  />
                  功能测试通过
                </label>
                <label className="flex items-center gap-3 rounded border border-gray-200 p-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.repairHistoryDeclared}
                    onChange={(event) => updateField("repairHistoryDeclared", event.target.checked)}
                  />
                  已声明维修历史
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">商品描述与证明材料</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700">商品描述</label>
                <textarea
                  required
                  rows="4"
                  aria-label="商品描述"
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                />
              </div>

              <div className="space-y-4 rounded-md border border-gray-200 bg-gray-50 p-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">检测报告（PDF）</label>
                  <input
                    type="file"
                    accept=".pdf"
                    required
                    onChange={(event) => setFileReport(event.target.files[0])}
                    className="text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">资质材料（PDF）</label>
                  <input
                    type="file"
                    accept=".pdf"
                    required
                    onChange={(event) => setFileCert(event.target.files[0])}
                    className="text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-green-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-green-700 hover:file:bg-green-100"
                  />
                </div>
              </div>
            </section>

            <button
              type="submit"
              disabled={loading}
              className={`flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm ${
                loading ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {loading ? "处理中..." : "提交审核"}
            </button>

            {message && (
              <div
                className={`rounded p-3 text-center text-sm font-bold ${
                  message.includes("失败") || message.toLowerCase().includes("rejected")
                    ? "bg-red-100 text-red-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {message}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddProduct;
