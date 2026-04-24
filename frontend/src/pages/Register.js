import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import AuthService from "../services/auth.service";
import FileService from "../services/file.service";

const QUALIFICATION_OPTIONS = [
  { value: "retailer", label: "电子产品零售商" },
  { value: "brand_authorized", label: "品牌授权商家" },
  { value: "repair_service", label: "维修服务商" },
  { value: "used_device_specialist", label: "二手设备经营商" },
  { value: "comprehensive", label: "综合电子经营主体" },
];

const INITIAL_QUALIFICATIONS = {
  qualificationType: "retailer",
  brandAuthorizationHash: "",
  repairQualificationHash: "",
  usedDeviceQualificationHash: "",
  qualificationNotes: "",
};

const SELLER_FIELD_COPY = [
  {
    id: "brandAuthorizationHash",
    label: "品牌授权材料哈希",
    placeholder: "可填写 IPFS 哈希或授权备案编号",
  },
  {
    id: "repairQualificationHash",
    label: "维修资质材料哈希",
    placeholder: "可填写维修资质材料哈希",
  },
  {
    id: "usedDeviceQualificationHash",
    label: "二手设备经营材料哈希",
    placeholder: "可填写二手设备经营资质哈希",
  },
];

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("buyer");
  const [sellerQualifications, setSellerQualifications] = useState(INITIAL_QUALIFICATIONS);
  const [uploadingFields, setUploadingFields] = useState({});
  const [message, setMessage] = useState("");
  const [successful, setSuccessful] = useState(false);
  const [messageTone, setMessageTone] = useState("error");

  const sellerRegisterMessage = useMemo(
    () => "商家注册申请已提交，请等待监督方审核通过后登录。",
    []
  );

  const handleRegister = async (event) => {
    event.preventDefault();
    setMessage("");
    setSuccessful(false);
    setMessageTone("error");

    try {
      const safeRole = role === "seller" ? "seller" : "buyer";
      const metadata = safeRole === "seller" ? sellerQualifications : {};
      await AuthService.register(username, password, safeRole, metadata);
      setSuccessful(true);
      setMessageTone("success");
      setMessage(safeRole === "seller" ? sellerRegisterMessage : "注册成功，现在可以直接登录。");
    } catch (error) {
      const responseMessage = error.response?.data?.message || error.message;
      setMessage(responseMessage);
      setSuccessful(false);
      setMessageTone("error");
    }
  };

  const handleQualificationUpload = async (fieldId, qualificationKind, file) => {
    if (!file) {
      return;
    }

    setUploadingFields((previous) => ({ ...previous, [fieldId]: true }));
    setMessage("");

    try {
      const response = await FileService.uploadPublicSellerQualification(file, qualificationKind);
      setSellerQualifications((previous) => ({
        ...previous,
        [fieldId]: response.data.ipfsHash,
      }));
      setMessageTone("success");
      setMessage("资质文件上传成功，系统已自动回填 IPFS 哈希。");
      setSuccessful(false);
    } catch (error) {
      setMessage(error.response?.data?.message || error.message);
      setSuccessful(false);
      setMessageTone("error");
    } finally {
      setUploadingFields((previous) => ({ ...previous, [fieldId]: false }));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-slate-900">账号注册</h2>
          <p className="mt-2 text-sm text-slate-500">
            买家账号注册后可立即登录，商家账号可补充电子产品经营资质信息，供监督方审核使用。
          </p>
        </div>

        {message ? (
          <div
            className={`mb-5 rounded-lg p-3 text-sm ${
              messageTone === "success"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {message}
          </div>
        ) : null}

        {!successful ? (
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="register-username" className="mb-1 block text-sm font-medium text-slate-700">
                  用户名
                </label>
                <input
                  id="register-username"
                  type="text"
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="register-password" className="mb-1 block text-sm font-medium text-slate-700">
                  密码
                </label>
                <input
                  id="register-password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-role" className="mb-1 block text-sm font-medium text-slate-700">
                账号角色
              </label>
              <select
                id="register-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="buyer">买家账号（立即生效）</option>
                <option value="seller">商家账号（需监督方审核）</option>
              </select>
            </div>

            {role === "seller" ? (
              <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-indigo-900">电子产品商家资质信息</h3>
                  <p className="mt-1 text-sm text-indigo-700">
                    这些内容为可选项，但能帮助监督方判断该商家是否具备电子产品销售、维修或二手设备经营资质。
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="qualificationType" className="mb-1 block text-sm font-medium text-slate-700">
                      资质类型
                    </label>
                    <select
                      id="qualificationType"
                      value={sellerQualifications.qualificationType}
                      onChange={(event) =>
                        setSellerQualifications((previous) => ({
                          ...previous,
                          qualificationType: event.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      {QUALIFICATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {SELLER_FIELD_COPY.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <label htmlFor={field.id} className="mb-1 block text-sm font-medium text-slate-700">
                        {field.label}
                      </label>
                      <input
                        id={field.id}
                        type="text"
                        value={sellerQualifications[field.id]}
                        onChange={(event) =>
                          setSellerQualifications((previous) => ({
                            ...previous,
                            [field.id]: event.target.value,
                          }))
                        }
                        placeholder={field.placeholder}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer rounded-md bg-white px-3 py-2 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50">
                          {uploadingFields[field.id] ? "上传中..." : "上传材料"}
                          <input
                            type="file"
                            accept=".pdf,image/png,image/jpeg"
                            className="hidden"
                            disabled={Boolean(uploadingFields[field.id])}
                            onChange={(event) =>
                              handleQualificationUpload(
                                field.id,
                                field.id,
                                event.target.files?.[0] || null
                              )
                            }
                          />
                        </label>
                        <span className="text-xs text-slate-500">支持 PDF、PNG、JPG</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <label htmlFor="qualificationNotes" className="mb-1 block text-sm font-medium text-slate-700">
                    资质说明
                  </label>
                  <textarea
                    id="qualificationNotes"
                    rows={4}
                    value={sellerQualifications.qualificationNotes}
                    onChange={(event) =>
                      setSellerQualifications((previous) => ({
                        ...previous,
                        qualificationNotes: event.target.value,
                      }))
                    }
                    placeholder="补充说明品牌授权范围、维修服务范围或二手设备合规说明。"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
              </section>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
            >
              提交注册
            </button>
          </form>
        ) : null}

        <div className="mt-6 text-center text-sm text-slate-600">
          已有账号？
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            去登录
          </Link>
        </div>
      </div>
    </div>
  );
}
