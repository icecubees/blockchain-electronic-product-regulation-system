import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ProductService from "../services/product.service";
import FileService from "../services/file.service";
import AuthService from "../services/auth.service";

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

const COMPLAINT_TYPES = [
  { value: "battery_issue", label: "电池问题" },
  { value: "counterfeit_suspected", label: "疑似假货" },
  { value: "refurbished_not_disclosed", label: "翻新未披露" },
  { value: "serial_number_mismatch", label: "序列号不一致" },
  { value: "performance_issue", label: "性能问题" },
  { value: "accessory_mismatch", label: "配件不符" },
  { value: "safety_risk", label: "安全风险" },
];
const DIRECT_COMPLAINT_TYPES = COMPLAINT_TYPES.filter((item) =>
  [
    "battery_issue",
    "counterfeit_suspected",
    "refurbished_not_disclosed",
    "serial_number_mismatch",
    "safety_risk",
  ].includes(item.value)
);

const AFTER_SALES_TYPES = [
  { value: "warranty_claim", label: "保修申请" },
  { value: "repair", label: "维修" },
  { value: "component_replacement", label: "部件更换" },
  { value: "quality_refund", label: "质量退款" },
];

function getShippingLabel(order) {
  if (order.shippingStatus === "shipped") return "运输中";
  if (order.shippingStatus === "delivered") return "已送达";
  return "待发货";
}

function getOrderStatusLabel(order) {
  switch (order.status) {
    case 0:
      return order.shippingStatus === "shipped" ? "待收货" : "待发货";
    case 1:
      return "待评价";
    case 2:
      return "已完成";
    case 3:
      return "投诉处理中";
    case 4:
      return "已退款";
    default:
      return "未知状态";
  }
}

function getStatusClass(order) {
  if (order.status === 4) return "bg-slate-100 text-slate-700";
  if (order.status === 3) return "bg-rose-100 text-rose-700";
  if (order.status === 2) return "bg-emerald-100 text-emerald-700";
  if (order.status === 1) return "bg-amber-100 text-amber-700";
  if (order.shippingStatus === "shipped") return "bg-indigo-100 text-indigo-700";
  return "bg-sky-100 text-sky-700";
}

function getComplaintTypeLabel(type) {
  return COMPLAINT_TYPES.find((item) => item.value === type)?.label || type || "一般投诉";
}

function getAfterSalesTypeLabel(type) {
  return AFTER_SALES_TYPES.find((item) => item.value === type)?.label || type || "售后记录";
}

function getAfterSalesRequestStatusLabel(status) {
  switch (status) {
    case "seller_responded":
      return "卖家已响应";
    case "escalated_to_complaint":
      return "已升级投诉";
    case "closed":
      return "已关闭";
    default:
      return "待卖家处理";
  }
}

function getPaymentStatusLabel(status) {
  switch (status) {
    case "paid":
      return "已支付";
    case "refunded":
      return "已退款";
    case "failed":
      return "支付失败";
    default:
      return "待支付";
  }
}

function getRefundStatusLabel(status) {
  switch (status) {
    case "pending_review":
      return "退款审核中";
    case "refunded":
      return "退款完成";
    case "rejected":
      return "退款驳回";
    default:
      return "无退款";
  }
}

function getRecallNotificationStatusLabel(status) {
  switch (status) {
    case "viewed":
      return "已查看";
    case "acknowledged":
      return "已确认";
    case "closed":
      return "已关闭";
    default:
      return "待处理";
  }
}

function formatOrderDateTime(value, fallback = "暂无") {
  return value ? new Date(value).toLocaleString() : fallback;
}

function formatOrderAmount(value) {
  return Number.isFinite(Number(value)) ? `${Number(value)} ETH` : "0 ETH";
}

function getProductTraceId(order) {
  return order.product?.id || order.productId || order.product?.productId;
}

function getOrderTraceViewerRole(user) {
  if (user?.role === "regulator" || user?.role === "admin") {
    return "regulator";
  }
  if (user?.role === "seller") {
    return "seller";
  }
  return "buyer";
}

function buildOrderTraceEvents(order) {
  const events = [
    {
      key: "created",
      type: "purchase",
      title: "订单创建",
      time: order.createdAt,
      description: `买家购买 ${order.product?.name || "商品"}，订单金额 ${formatOrderAmount(order.price)}。`,
      visibleTo: ["buyer", "seller", "regulator"],
    },
    {
      key: "payment",
      type: "payment",
      title: "支付记录",
      time: order.paidAt,
      description: `支付状态：${getPaymentStatusLabel(order.paymentStatus)}，凭证：${order.paymentReference || order.paymentMethod || "暂无"}。`,
      visibleTo: ["buyer", "seller", "regulator"],
    },
    {
      key: "shipment",
      type: "shipment",
      title: "发货物流",
      time: order.shippedAt,
      description: `${order.shippingCarrier || "承运方未提供"} / ${order.trackingNumber || "物流单号未提供"}，当前状态：${getShippingLabel(order)}。`,
      visibleTo: ["buyer", "seller", "regulator"],
    },
  ];

  if (order.comment || order.rating) {
    events.push({
      key: "rating",
      type: "rating",
      title: "收货评价",
      time: order.updatedAt,
      description: `${order.rating ? `${order.rating}/5` : "未评分"}${order.comment ? `，${order.comment}` : ""}`,
      visibleTo: ["buyer", "seller", "regulator"],
    });
  }

  if (order.refundStatus && order.refundStatus !== "none") {
    events.push({
      key: "refund",
      type: "refund",
      title: "退款记录",
      time: order.refundedAt,
      description: `退款状态：${getRefundStatusLabel(order.refundStatus)}，金额：${formatOrderAmount(order.refundAmount)}。`,
      visibleTo: ["buyer", "seller", "regulator"],
    });
  }

  if (Array.isArray(order.recallNotifications)) {
    order.recallNotifications.forEach((notification) => {
      events.push({
        key: `recall-${notification.id}`,
        type: "recall",
        title: "召回通知",
        time: notification.notifiedAt,
        description: `召回原因：${order.product?.recallReason || "召回处理中"}，通知状态：${getRecallNotificationStatusLabel(notification.status)}。`,
        visibleTo: ["buyer", "seller", "regulator"],
      });
    });
  }

  if (Array.isArray(order.afterSalesRequests)) {
    order.afterSalesRequests.forEach((request) => {
      events.push({
        key: `after-sales-request-${request.id}`,
        type: "after_sales_request",
        title: "买家售后申请",
        time: request.createdAt,
        description: `${getAfterSalesTypeLabel(request.type)} / ${getAfterSalesRequestStatusLabel(request.status)}：${request.description || "未提供说明"}`,
        visibleTo: ["buyer", "seller", "regulator"],
      });

      if (request.sellerResponse) {
        events.push({
          key: `after-sales-response-${request.id}`,
          type: "after_sales_response",
          title: "商家售后响应",
          time: request.updatedAt || request.createdAt,
          description: request.sellerResponse,
          visibleTo: ["buyer", "seller", "regulator"],
        });
      }
    });
  }

  if (Array.isArray(order.afterSalesRecords)) {
    order.afterSalesRecords.forEach((record) => {
      events.push({
        key: `after-sales-record-${record.id}`,
        type: "after_sales_record",
        title: "售后服务记录",
        time: record.createdAt,
        description: `${getAfterSalesTypeLabel(record.type)}${record.componentName ? ` / ${record.componentName}` : ""}：${record.description || "未提供说明"}。结果：${record.serviceResult || "未提供"}`,
        visibleTo: ["buyer", "seller", "regulator"],
      });
    });
  }

  if (order.complaintReason) {
    events.push({
      key: "complaint",
      type: "complaint",
      title: "监管投诉",
      time: order.complaintAt || order.updatedAt,
      description: `${getComplaintTypeLabel(order.complaintType)} / ${order.complaintReason}`,
      visibleTo: ["buyer", "seller", "regulator"],
    });
  }

  if (order.sellerResponse) {
    events.push({
      key: "seller-response",
      type: "complaint_response",
      title: "商家投诉答辩",
      time: order.sellerRespondedAt || order.updatedAt,
      description: order.sellerResponse,
      visibleTo: ["buyer", "seller", "regulator"],
    });
  }

  if (order.rulingDetails) {
    events.push({
      key: "ruling",
      type: "ruling",
      title: "监管裁决",
      time: order.resolvedAt || order.updatedAt,
      description: order.rulingDetails,
      visibleTo: ["regulator", "buyer", "seller"],
    });
  }

  return events
    .filter((event) => event.time || event.description)
    .sort((left, right) => new Date(left.time || 0) - new Date(right.time || 0));
}

function OrderTracePanel({ order, currentUser }) {
  const viewerRole = getOrderTraceViewerRole(currentUser);
  const events = buildOrderTraceEvents(order).filter((event) =>
    event.visibleTo.includes(viewerRole)
  );
  const product = order.product || {};

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-indigo-950">订单级溯源链</div>
          <p className="mt-1 text-sm text-indigo-800">
            围绕当前订单展示商品购买、履约、售后、投诉与召回过程。
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700">
          {viewerRole === "seller" ? "商家可见" : viewerRole === "regulator" ? "监管可见" : "买家可见"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded-xl bg-white p-3">
          <div className="text-slate-500">商品</div>
          <div className="mt-1 font-semibold text-slate-900">{product.name || "未提供"}</div>
        </div>
        <div className="rounded-xl bg-white p-3">
          <div className="text-slate-500">品牌 / 型号</div>
          <div className="mt-1 font-semibold text-slate-900">
            {[product.brand, product.model].filter(Boolean).join(" / ") || "未提供"}
          </div>
        </div>
        <div className="rounded-xl bg-white p-3">
          <div className="text-slate-500">订单状态</div>
          <div className="mt-1 font-semibold text-slate-900">{getOrderStatusLabel(order)}</div>
        </div>
        <div className="rounded-xl bg-white p-3">
          <div className="text-slate-500">支付状态</div>
          <div className="mt-1 font-semibold text-slate-900">
            {getPaymentStatusLabel(order.paymentStatus)}
          </div>
        </div>
        <div className="rounded-xl bg-white p-3">
          <div className="text-slate-500">召回状态</div>
          <div className="mt-1 font-semibold text-slate-900">
            {order.recallNotifications?.length || product.recallStatus ? "存在召回记录" : "暂无召回"}
          </div>
        </div>
        <div className="rounded-xl bg-white p-3">
          <div className="text-slate-500">售后记录</div>
          <div className="mt-1 font-semibold text-slate-900">
            {(order.afterSalesRequests?.length || 0) + (order.afterSalesRecords?.length || 0)} 条
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {events.length > 0 ? (
          events.map((event, index) => (
            <div key={event.key} className="flex gap-3 rounded-xl bg-white p-4 text-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">{event.title}</div>
                  <div className="text-xs text-slate-500">{formatOrderDateTime(event.time)}</div>
                </div>
                <div className="mt-1 text-slate-600">{event.description}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
            当前订单暂无可展示的溯源链节点。
          </div>
        )}
      </div>
    </div>
  );
}

const INITIAL_COMPLAINT_STATE = {
  type: DIRECT_COMPLAINT_TYPES[0].value,
  reason: "",
  file: null,
};

const INITIAL_AFTER_SALES_REQUEST_STATE = {
  type: AFTER_SALES_TYPES[0].value,
  description: "",
  file: null,
};

const INITIAL_AFTER_SALES_FORM = {
  type: AFTER_SALES_TYPES[0].value,
  componentName: "",
  description: "",
  serviceResult: "",
  file: null,
};

export default function OrderCenter() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(undefined);
  const [afterSalesRequestOrder, setAfterSalesRequestOrder] = useState(null);
  const [afterSalesRequestForm, setAfterSalesRequestForm] = useState(
    INITIAL_AFTER_SALES_REQUEST_STATE
  );
  const [complaintOrder, setComplaintOrder] = useState(null);
  const [complaintForm, setComplaintForm] = useState(INITIAL_COMPLAINT_STATE);
  const [sellerEvidenceFiles, setSellerEvidenceFiles] = useState({});
  const [afterSalesRequestResponseFiles, setAfterSalesRequestResponseFiles] = useState({});
  const [ratingForms, setRatingForms] = useState({});
  const [shipmentForms, setShipmentForms] = useState({});
  const [sellerResponseForms, setSellerResponseForms] = useState({});
  const [afterSalesRequestResponseForms, setAfterSalesRequestResponseForms] = useState({});
  const [afterSalesForms, setAfterSalesForms] = useState({});
  const [expandedTraceOrders, setExpandedTraceOrders] = useState({});

  const navigate = useNavigate();

  useEffect(() => {
    const user = AuthService.getCurrentUser();
    if (!user) {
      navigate("/login");
      return;
    }

    setCurrentUser(user);
    loadOrders();
  }, [navigate]);

  const loadOrders = () => {
    ProductService.getMyOrders().then(
      (response) => setOrders(response.data),
      (error) => console.error(error)
    );
  };

  const updateRatingForm = (orderId, field, value) => {
    setRatingForms((previous) => ({
      ...previous,
      [orderId]: {
        score: previous[orderId]?.score || 5,
        comment: previous[orderId]?.comment || "",
        [field]: value,
      },
    }));
  };

  const updateShipmentForm = (orderId, field, value) => {
    setShipmentForms((previous) => ({
      ...previous,
      [orderId]: {
        trackingNumber: previous[orderId]?.trackingNumber || "",
        shippingCarrier: previous[orderId]?.shippingCarrier || "",
        [field]: value,
      },
    }));
  };

  const updateSellerResponseForm = (orderId, value) => {
    setSellerResponseForms((previous) => ({
      ...previous,
      [orderId]: value,
    }));
  };

  const updateAfterSalesForm = (orderId, field, value) => {
    setAfterSalesForms((previous) => ({
      ...previous,
      [orderId]: {
        ...(previous[orderId] || INITIAL_AFTER_SALES_FORM),
        [field]: value,
      },
    }));
  };

  const resetComplaintModal = () => {
    setComplaintOrder(null);
    setComplaintForm(INITIAL_COMPLAINT_STATE);
  };

  const resetAfterSalesRequestModal = () => {
    setAfterSalesRequestOrder(null);
    setAfterSalesRequestForm(INITIAL_AFTER_SALES_REQUEST_STATE);
  };

  const resetAfterSalesForm = (orderId) => {
    setAfterSalesForms((previous) => ({
      ...previous,
      [orderId]: INITIAL_AFTER_SALES_FORM,
    }));
  };

  const toggleOrderTrace = (orderId) => {
    setExpandedTraceOrders((previous) => ({
      ...previous,
      [orderId]: !previous[orderId],
    }));
  };

  const handleConfirm = async (orderId) => {
    setLoading(true);
    try {
      await ProductService.confirmReceipt(orderId);
      window.alert("确认收货成功，现在可以提交评价。");
      loadOrders();
    } catch (error) {
      window.alert(`操作失败：${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAfterSalesRequest = async (event) => {
    event.preventDefault();
    if (!afterSalesRequestForm.description.trim()) {
      window.alert("请输入售后申请说明。");
      return;
    }

    setLoading(true);
    try {
      let evidenceIpfsHash = null;
      if (afterSalesRequestForm.file) {
        const uploadResponse = await FileService.uploadAfterSalesEvidence(afterSalesRequestForm.file);
        evidenceIpfsHash = uploadResponse.data.ipfsHash;
      }

      await ProductService.createAfterSalesRequest({
        orderId: afterSalesRequestOrder.id,
        type: afterSalesRequestForm.type,
        description: afterSalesRequestForm.description,
        evidenceIpfsHash,
      });

      window.alert("售后申请提交成功。");
      resetAfterSalesRequestModal();
      loadOrders();
    } catch (error) {
      window.alert(`售后申请提交失败：${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleShip = async (orderId) => {
    const form = shipmentForms[orderId] || {};
    const trackingNumber = String(form.trackingNumber || "").trim();
    const shippingCarrier = String(form.shippingCarrier || "").trim();

    if (!trackingNumber) {
      window.alert("请输入物流单号。");
      return;
    }

    setLoading(true);
    try {
      await ProductService.shipOrder(orderId, trackingNumber, shippingCarrier);
      window.alert("订单已标记为发货。");
      resetAfterSalesForm(orderId);
      setShipmentForms((previous) => ({
        ...previous,
        [orderId]: {
          trackingNumber: "",
          shippingCarrier: "",
        },
      }));
      loadOrders();
    } catch (error) {
      window.alert(`发货失败：${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async (orderId) => {
    const form = ratingForms[orderId] || { score: 5, comment: "" };
    setLoading(true);
    try {
      await ProductService.rateOrder(orderId, form.score, form.comment);
      window.alert("评价提交成功。");
      setRatingForms((previous) => ({
        ...previous,
        [orderId]: { score: 5, comment: "" },
      }));
      loadOrders();
    } catch (error) {
      window.alert(`评价提交失败：${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComplaint = async (event) => {
    event.preventDefault();
    if (!complaintForm.reason.trim()) {
      window.alert("请输入投诉原因。");
      return;
    }

    setLoading(true);
    try {
      let evidenceIpfsHash = null;
      if (complaintForm.file) {
        const uploadResponse = await FileService.uploadComplaintEvidence(complaintForm.file);
        evidenceIpfsHash = uploadResponse.data.ipfsHash;
      }

      await ProductService.raiseComplaint(
        complaintOrder.id,
        complaintForm.reason,
        evidenceIpfsHash,
        complaintForm.type
      );

      window.alert("投诉提交成功。");
      resetComplaintModal();
      loadOrders();
    } catch (error) {
      window.alert(`投诉提交失败：${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSellerResponse = async (orderId) => {
    const response = String(sellerResponseForms[orderId] || "").trim();
    if (!response) {
      window.alert("请输入卖家答辩内容。");
      return;
    }

    setLoading(true);
    try {
      let evidenceIpfsHash = null;
      if (sellerEvidenceFiles[orderId]) {
        const uploadResponse = await FileService.uploadSellerComplaintEvidence(sellerEvidenceFiles[orderId]);
        evidenceIpfsHash = uploadResponse.data.ipfsHash;
      }

      await ProductService.respondToComplaint(orderId, response, evidenceIpfsHash);
      window.alert("卖家答辩提交成功。");
      setSellerResponseForms((previous) => ({ ...previous, [orderId]: "" }));
      setSellerEvidenceFiles((previous) => ({ ...previous, [orderId]: null }));
      loadOrders();
    } catch (error) {
      window.alert(`答辩提交失败：${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAfterSalesSubmit = async (order) => {
    const form = afterSalesForms[order.id] || INITIAL_AFTER_SALES_FORM;
    if (!String(form.description || "").trim()) {
      window.alert("请输入售后说明。");
      return;
    }

    setLoading(true);
    try {
      let evidenceIpfsHash = null;
      if (form.file) {
        const uploadResponse = await FileService.uploadAfterSalesEvidence(form.file);
        evidenceIpfsHash = uploadResponse.data.ipfsHash;
      }

      await ProductService.recordAfterSales({
        orderId: order.id,
        type: form.type,
        componentName: form.componentName,
        description: form.description,
        serviceResult: form.serviceResult,
        evidenceIpfsHash,
      });

      window.alert("售后记录已保存。");
      resetAfterSalesForm(order.id);
      loadOrders();
    } catch (error) {
      window.alert(`售后保存失败：${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAfterSalesRequestResponse = async (requestId) => {
    const response = String(afterSalesRequestResponseForms[requestId] || "").trim();
    if (!response) {
      window.alert("请输入售后处理回复。");
      return;
    }

    setLoading(true);
    try {
      let evidenceIpfsHash = null;
      if (afterSalesRequestResponseFiles[requestId]) {
        const uploadResponse = await FileService.uploadAfterSalesEvidence(
          afterSalesRequestResponseFiles[requestId]
        );
        evidenceIpfsHash = uploadResponse.data.ipfsHash;
      }

      await ProductService.respondToAfterSalesRequest(requestId, response, evidenceIpfsHash);
      window.alert("售后申请回复成功。");
      setAfterSalesRequestResponseForms((previous) => ({ ...previous, [requestId]: "" }));
      setAfterSalesRequestResponseFiles((previous) => ({ ...previous, [requestId]: null }));
      loadOrders();
    } catch (error) {
      window.alert(`售后申请回复失败：${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecallNotificationUpdate = async (notificationId, status = "acknowledged") => {
    setLoading(true);
    try {
      await ProductService.updateRecallNotificationStatus(notificationId, status);
      window.alert("召回通知状态已更新。");
      loadOrders();
    } catch (error) {
      window.alert(`召回通知更新失败：${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="bg-white py-4 shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4">
          <h1 className="text-2xl font-bold text-slate-900">
            {currentUser?.role === "buyer" ? "我的订单" : "销售订单"}
          </h1>
          <button onClick={() => navigate("/home")} className="font-medium text-indigo-600">
            返回市场
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-8">
        {loading ? <div className="text-center font-bold text-indigo-600">正在同步订单状态...</div> : null}

        {orders.map((order) => {
          const ratingForm = ratingForms[order.id] || { score: 5, comment: "" };
          const shipmentForm = shipmentForms[order.id] || { trackingNumber: "", shippingCarrier: "" };
          const sellerResponse = sellerResponseForms[order.id] || "";
          const afterSalesForm = afterSalesForms[order.id] || INITIAL_AFTER_SALES_FORM;
          const productTraceId = getProductTraceId(order);
          const isTraceExpanded = Boolean(expandedTraceOrders[order.id]);
          const afterSalesRequests = Array.isArray(order.afterSalesRequests)
            ? order.afterSalesRequests
            : [];
          const recallNotification = Array.isArray(order.recallNotifications)
            ? order.recallNotifications[0]
            : null;
          const canRecordAfterSales =
            currentUser?.role === "seller" && [1, 2, 3, 4].includes(order.status);
          const canCreateAfterSalesRequest =
            currentUser?.role === "buyer" && [0, 1, 2].includes(order.status);
          const canOpenComplaint =
            currentUser?.role === "buyer" && [0, 1, 2].includes(order.status) && order.status !== 3;

          return (
            <div key={order.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-xs text-slate-500">
                    订单 #{order.id} | {new Date(order.createdAt).toLocaleString()}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {order.product?.name}
                    <span className="ml-2 text-sm font-normal text-slate-500">({order.price} ETH)</span>
                  </h3>
                  <div className="text-sm text-slate-600">
                    {currentUser?.role === "buyer"
                      ? `卖家：${order.product?.seller?.username}`
                      : `买家：${order.buyer?.username}`}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${getStatusClass(order)}`}>
                    {getOrderStatusLabel(order)}
                  </span>
                  <span className="text-xs text-slate-500">物流：{getShippingLabel(order)}</span>
                  <div className="flex flex-wrap justify-end gap-2">
                    {productTraceId ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/trace?productId=${encodeURIComponent(productTraceId)}`)}
                        className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        Product trace
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleOrderTrace(order.id)}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      {isTraceExpanded ? "Hide order trace" : "Order trace"}
                    </button>
                  </div>
                </div>
              </div>


              {isTraceExpanded ? (
                <OrderTracePanel order={order} currentUser={currentUser} />
              ) : null}

              <div className="grid gap-4 text-sm md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-slate-500">物流单号</div>
                  <div className="mt-1 font-semibold">{order.trackingNumber || "未提供"}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-slate-500">承运方</div>
                  <div className="mt-1 font-semibold">{order.shippingCarrier || "未提供"}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-slate-500">发货时间</div>
                  <div className="mt-1 font-semibold">
                    {order.shippedAt ? new Date(order.shippedAt).toLocaleString() : "未提供"}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 text-sm md:grid-cols-3">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                  <div className="text-emerald-700">支付状态</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {getPaymentStatusLabel(order.paymentStatus)}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                  <div className="text-emerald-700">支付凭证</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {order.paymentReference || order.paymentMethod || "暂无"}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                  <div className="text-emerald-700">支付时间</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {formatOrderDateTime(order.paidAt)}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 text-sm md:grid-cols-3">
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <div className="text-amber-700">退款状态</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {getRefundStatusLabel(order.refundStatus)}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <div className="text-amber-700">退款金额</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {formatOrderAmount(order.refundAmount)}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <div className="text-amber-700">退款时间</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {formatOrderDateTime(order.refundedAt)}
                  </div>
                </div>
              </div>

              {recallNotification ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-rose-800">召回通知</div>
                      <div className="mt-1 text-sm text-rose-700">
                        状态：{getRecallNotificationStatusLabel(recallNotification.status)}
                      </div>
                      <div className="mt-1 text-sm text-rose-700">
                        通知时间：{formatOrderDateTime(recallNotification.notifiedAt)}
                      </div>
                      <div className="mt-1 text-sm text-rose-700">
                        召回原因：{order.product?.recallReason || "召回处理中"}
                      </div>
                    </div>
                    {currentUser?.role === "buyer" &&
                    !["acknowledged", "closed"].includes(recallNotification.status) ? (
                      <button
                        onClick={() =>
                          handleRecallNotificationUpdate(recallNotification.id, "acknowledged")
                        }
                        className="rounded bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                      >
                        确认已知悉
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {order.comment ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                  买家评价：{order.comment}（{order.rating}/5）
                </div>
              ) : null}

              {afterSalesRequests.length > 0 ? (
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                  <div className="mb-3 font-semibold text-cyan-900">售后申请</div>
                  <div className="space-y-3">
                    {afterSalesRequests.map((request) => {
                      const requestResponse = afterSalesRequestResponseForms[request.id] || "";

                      return (
                        <div
                          key={request.id}
                          className="rounded-xl border border-cyan-200 bg-white p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-slate-900">
                                {getAfterSalesTypeLabel(request.type)}
                              </div>
                              <div className="mt-1 text-slate-500">
                                状态：{getAfterSalesRequestStatusLabel(request.status)}
                              </div>
                            </div>
                            <div className="text-xs text-slate-500">
                              {request.createdAt
                                ? new Date(request.createdAt).toLocaleString()
                                : "未知时间"}
                            </div>
                          </div>

                          <div className="mt-3 text-slate-700">{request.description}</div>

                          {request.evidenceIpfsHash ? (
                            <a
                              href={`${IPFS_GATEWAY}${request.evidenceIpfsHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-block text-indigo-600 underline"
                            >
                              查看售后申请证据
                            </a>
                          ) : null}

                          {request.sellerResponse ? (
                            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="font-semibold text-slate-700">卖家售后响应</div>
                              <div className="mt-1 text-slate-600">{request.sellerResponse}</div>
                              {request.sellerEvidenceIpfsHash ? (
                                <a
                                  href={`${IPFS_GATEWAY}${request.sellerEvidenceIpfsHash}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-block text-indigo-600 underline"
                                >
                                  查看卖家响应证据
                                </a>
                              ) : null}
                            </div>
                          ) : null}

                          {currentUser?.role === "seller" && request.status === "pending_seller" ? (
                            <div className="mt-4 space-y-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                              <div className="font-semibold text-cyan-900">回复售后申请</div>
                              <textarea
                                rows={3}
                                value={requestResponse}
                                onChange={(event) =>
                                  setAfterSalesRequestResponseForms((previous) => ({
                                    ...previous,
                                    [request.id]: event.target.value,
                                  }))
                                }
                                className="w-full rounded border border-cyan-200 px-3 py-2 text-sm"
                                placeholder="说明维修方案、补偿方案或处理安排。"
                              />
                              <input
                                type="file"
                                accept=".pdf,image/png,image/jpeg"
                                onChange={(event) =>
                                  setAfterSalesRequestResponseFiles((previous) => ({
                                    ...previous,
                                    [request.id]: event.target.files[0] || null,
                                  }))
                                }
                                className="block w-full text-sm text-slate-500 file:mr-4 file:rounded file:border-0 file:bg-cyan-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-cyan-700 hover:file:bg-cyan-200"
                              />
                              <button
                                onClick={() => handleAfterSalesRequestResponse(request.id)}
                                className="rounded bg-cyan-700 px-4 py-2 text-white hover:bg-cyan-800"
                              >
                                提交售后响应
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {order.complaintReason ? (
                <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm">
                  <div>
                    <div className="font-semibold text-rose-700">投诉记录</div>
                    <div className="mt-1 text-rose-700">
                      {getComplaintTypeLabel(order.complaintType)} / {order.complaintReason}
                    </div>
                  </div>
                  {order.evidenceIpfsHash ? (
                    <a
                      href={`${IPFS_GATEWAY}${order.evidenceIpfsHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-indigo-600 underline"
                    >
                      查看买家证据
                    </a>
                  ) : null}
                  {order.sellerResponse ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="font-semibold text-slate-700">卖家答辩</div>
                      <div className="mt-1 text-slate-600">{order.sellerResponse}</div>
                      {order.sellerEvidenceIpfsHash ? (
                        <a
                          href={`${IPFS_GATEWAY}${order.sellerEvidenceIpfsHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-indigo-600 underline"
                        >
                          查看卖家证据
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  {order.rulingDetails ? <div className="text-slate-700">裁决：{order.rulingDetails}</div> : null}
                </div>
              ) : null}

              {order.afterSalesRecords?.length > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 font-semibold text-slate-800">卖家售后记录</div>
                  <div className="space-y-3">
                    {order.afterSalesRecords.map((record) => (
                      <div key={record.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{getAfterSalesTypeLabel(record.type)}</span>
                          <span className="text-xs text-slate-500">
                            {record.createdAt ? new Date(record.createdAt).toLocaleString() : "未知时间"}
                          </span>
                        </div>
                        <div className="mt-2 text-slate-600">
                          {record.componentName ? `${record.componentName} / ` : ""}
                          {record.description}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          结果：{record.serviceResult || "未提供"} | 记录人：{record.creator?.username || "系统"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {currentUser?.role === "buyer" && order.status === 0 ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleConfirm(order.id)}
                    disabled={order.shippingStatus === "pending"}
                    className={`rounded px-4 py-2 text-white ${
                      order.shippingStatus === "pending"
                        ? "cursor-not-allowed bg-slate-300"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    确认收货
                  </button>
                  {canCreateAfterSalesRequest ? (
                    <button
                      onClick={() => {
                        setAfterSalesRequestOrder(order);
                        setAfterSalesRequestForm(INITIAL_AFTER_SALES_REQUEST_STATE);
                      }}
                      className="rounded bg-cyan-600 px-4 py-2 text-white hover:bg-cyan-700"
                    >
                      申请售后
                    </button>
                  ) : null}
                  {canOpenComplaint ? (
                    <button
                      onClick={() => {
                        setComplaintOrder(order);
                        setComplaintForm(INITIAL_COMPLAINT_STATE);
                      }}
                      className="rounded bg-rose-600 px-4 py-2 text-white hover:bg-rose-700"
                    >
                      监管投诉
                    </button>
                  ) : null}
                </div>
              ) : null}

              {currentUser?.role === "buyer" && order.status === 1 ? (
                <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="font-semibold text-amber-700">提交评价</div>
                  <div className="flex items-center gap-2">
                    <span>评分</span>
                    <select
                      value={ratingForm.score}
                      onChange={(event) => updateRatingForm(order.id, "score", event.target.value)}
                      className="rounded border border-amber-200 px-2 py-1 text-sm"
                    >
                      {[5, 4, 3, 2, 1].map((score) => (
                        <option key={score} value={score}>
                          {score}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    placeholder="请描述你的使用体验。"
                    className="w-full rounded border border-amber-200 p-2 text-sm"
                    value={ratingForm.comment}
                    onChange={(event) => updateRatingForm(order.id, "comment", event.target.value)}
                  />
                  <button
                    onClick={() => handleSubmitRating(order.id)}
                    className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                  >
                    提交评价
                  </button>
                </div>
              ) : null}

              {currentUser?.role === "buyer" && [1, 2].includes(order.status) ? (
                <div className="flex flex-wrap gap-2">
                  {canCreateAfterSalesRequest ? (
                    <button
                      onClick={() => {
                        setAfterSalesRequestOrder(order);
                        setAfterSalesRequestForm(INITIAL_AFTER_SALES_REQUEST_STATE);
                      }}
                      className="rounded bg-cyan-600 px-4 py-2 text-white hover:bg-cyan-700"
                    >
                      申请售后
                    </button>
                  ) : null}
                  {canOpenComplaint ? (
                    <button
                      onClick={() => {
                        setComplaintOrder(order);
                        setComplaintForm(INITIAL_COMPLAINT_STATE);
                      }}
                      className="rounded bg-rose-600 px-4 py-2 text-white hover:bg-rose-700"
                    >
                      监管投诉
                    </button>
                  ) : null}
                </div>
              ) : null}

              {currentUser?.role === "seller" && order.status === 0 && order.shippingStatus !== "shipped" ? (
                <div className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                  <div className="font-semibold text-indigo-700">发货履约</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={shipmentForm.shippingCarrier}
                      onChange={(event) => updateShipmentForm(order.id, "shippingCarrier", event.target.value)}
                      className="rounded border border-indigo-200 px-3 py-2 text-sm"
                      placeholder="承运方"
                    />
                    <input
                      value={shipmentForm.trackingNumber}
                      onChange={(event) => updateShipmentForm(order.id, "trackingNumber", event.target.value)}
                      className="rounded border border-indigo-200 px-3 py-2 text-sm"
                      placeholder="物流单号"
                    />
                  </div>
                  <button
                    onClick={() => handleShip(order.id)}
                    className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                  >
                    确认发货
                  </button>
                </div>
              ) : null}

              {canRecordAfterSales ? (
                <div className="space-y-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                  <div className="font-semibold text-cyan-800">记录售后服务</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      value={afterSalesForm.type}
                      onChange={(event) => updateAfterSalesForm(order.id, "type", event.target.value)}
                      className="rounded border border-cyan-200 px-3 py-2 text-sm"
                    >
                      {AFTER_SALES_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={afterSalesForm.componentName}
                      onChange={(event) => updateAfterSalesForm(order.id, "componentName", event.target.value)}
                      className="rounded border border-cyan-200 px-3 py-2 text-sm"
                      placeholder="部件名称（可选）"
                    />
                  </div>
                  <textarea
                    rows={3}
                    value={afterSalesForm.description}
                    onChange={(event) => updateAfterSalesForm(order.id, "description", event.target.value)}
                    className="w-full rounded border border-cyan-200 px-3 py-2 text-sm"
                    placeholder="描述保修、维修、更换或退款的处理情况。"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={afterSalesForm.serviceResult}
                      onChange={(event) => updateAfterSalesForm(order.id, "serviceResult", event.target.value)}
                      className="rounded border border-cyan-200 px-3 py-2 text-sm"
                      placeholder="处理结果"
                    />
                    <input
                      type="file"
                      accept=".pdf,image/png,image/jpeg"
                      onChange={(event) => updateAfterSalesForm(order.id, "file", event.target.files[0] || null)}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:rounded file:border-0 file:bg-cyan-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-cyan-700 hover:file:bg-cyan-200"
                    />
                  </div>
                  <button
                    onClick={() => handleAfterSalesSubmit(order)}
                    className="rounded bg-cyan-700 px-4 py-2 text-white hover:bg-cyan-800"
                  >
                    保存售后记录
                  </button>
                </div>
              ) : null}

              {currentUser?.role === "seller" && order.status === 3 ? (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="font-semibold text-slate-800">卖家答辩</div>
                  <textarea
                    rows={3}
                    value={sellerResponse}
                    onChange={(event) => updateSellerResponseForm(order.id, event.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="说明物流状态、商品状态或相关证明事实。"
                  />
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg"
                    onChange={(event) =>
                      setSellerEvidenceFiles((previous) => ({
                        ...previous,
                        [order.id]: event.target.files[0] || null,
                      }))
                    }
                    className="block w-full text-sm text-slate-500 file:mr-4 file:rounded file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                  />
                  <button
                    onClick={() => handleSellerResponse(order.id)}
                    className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
                  >
                    提交卖家答辩
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}

        {orders.length === 0 ? <div className="py-10 text-center text-slate-500">暂无订单记录。</div> : null}
      </div>

      {afterSalesRequestOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-cyan-700 p-4">
              <h2 className="text-lg font-bold text-white">提交售后申请</h2>
            </div>

            <form onSubmit={handleSubmitAfterSalesRequest} className="p-6">
              <div className="mb-4 text-sm text-slate-600">
                当前商品：
                <span className="font-bold text-slate-800"> {afterSalesRequestOrder.product?.name}</span>
              </div>

              <div className="mb-4">
                <label htmlFor="after-sales-request-type" className="mb-1 block text-sm font-medium text-slate-700">
                  售后诉求
                </label>
                <select
                  id="after-sales-request-type"
                  value={afterSalesRequestForm.type}
                  onChange={(event) =>
                    setAfterSalesRequestForm((previous) => ({
                      ...previous,
                      type: event.target.value,
                    }))
                  }
                  className="w-full rounded border border-slate-300 p-2"
                >
                  {AFTER_SALES_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor="after-sales-request-description" className="mb-1 block text-sm font-medium text-slate-700">
                  申请说明 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="after-sales-request-description"
                  required
                  rows={4}
                  className="w-full rounded border border-slate-300 p-2"
                  placeholder="请描述故障、履约问题或希望的处理方式。"
                  value={afterSalesRequestForm.description}
                  onChange={(event) =>
                    setAfterSalesRequestForm((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="mb-6">
                <label htmlFor="after-sales-request-evidence" className="mb-1 block text-sm font-medium text-slate-700">
                  证据文件（可选）
                </label>
                <input
                  id="after-sales-request-evidence"
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  onChange={(event) =>
                    setAfterSalesRequestForm((previous) => ({
                      ...previous,
                      file: event.target.files[0] || null,
                    }))
                  }
                  className="block w-full text-sm text-slate-500 file:mr-4 file:rounded file:border-0 file:bg-cyan-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-cyan-700 hover:file:bg-cyan-100"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={resetAfterSalesRequestModal}
                  className="rounded bg-slate-100 px-4 py-2 text-slate-700 hover:bg-slate-200"
                  disabled={loading}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`rounded px-4 py-2 font-bold text-white ${
                    loading ? "cursor-wait bg-cyan-400" : "bg-cyan-700 hover:bg-cyan-800"
                  }`}
                >
                  {loading ? "提交中..." : "提交售后申请"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {complaintOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-rose-600 p-4">
              <h2 className="text-lg font-bold text-white">提交监管投诉</h2>
            </div>

            <form onSubmit={handleSubmitComplaint} className="p-6">
              <div className="mb-4 text-sm text-slate-600">
                当前商品：<span className="font-bold text-slate-800">{complaintOrder.product?.name}</span>
              </div>
              <div className="mb-4 rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">
                此入口仅用于高风险问题，如安全风险、疑似假货、翻新未披露或序列号异常。
                普通质量/履约问题请先走售后申请。
              </div>

              <div className="mb-4">
                <label htmlFor="complaint-type" className="mb-1 block text-sm font-medium text-slate-700">
                  投诉类型
                </label>
                <select
                  id="complaint-type"
                  value={complaintForm.type}
                  onChange={(event) =>
                    setComplaintForm((previous) => ({
                      ...previous,
                      type: event.target.value,
                    }))
                  }
                  className="w-full rounded border border-slate-300 p-2"
                >
                  {DIRECT_COMPLAINT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor="complaint-reason" className="mb-1 block text-sm font-medium text-slate-700">
                  投诉原因 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="complaint-reason"
                  required
                  rows={3}
                  className="w-full rounded border border-slate-300 p-2"
                  placeholder="请详细描述问题。"
                  value={complaintForm.reason}
                  onChange={(event) =>
                    setComplaintForm((previous) => ({
                      ...previous,
                      reason: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="mb-6">
                <label htmlFor="complaint-evidence" className="mb-1 block text-sm font-medium text-slate-700">
                  证据文件（可选）
                </label>
                <input
                  id="complaint-evidence"
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  onChange={(event) =>
                    setComplaintForm((previous) => ({
                      ...previous,
                      file: event.target.files[0] || null,
                    }))
                  }
                  className="block w-full text-sm text-slate-500 file:mr-4 file:rounded file:border-0 file:bg-rose-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-rose-700 hover:file:bg-rose-100"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={resetComplaintModal}
                  className="rounded bg-slate-100 px-4 py-2 text-slate-700 hover:bg-slate-200"
                  disabled={loading}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`rounded px-4 py-2 font-bold text-white ${
                    loading ? "cursor-wait bg-rose-400" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {loading ? "提交中..." : "提交投诉"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
