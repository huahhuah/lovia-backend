const { handleLinePayRequest } = require("./linePay");
const { createEcpayPayment } = require("./ecpay");
const appError = require("../utils/appError");
const { dataSource } = require("../db/data-source");

async function createPaymentRequest(req, res, next) {
  const { amount, email, payment_type } = req.body;
  const { order_id } = req.params;

  const supportedTypes = ["linepay", "credit", "atm"];
  const sponsorshipRepo = dataSource.getRepository("Sponsorships");

  if (!order_id) {
    return next(appError(400, "缺少訂單 ID"));
  }

  if (!payment_type) {
    return next(appError(400, "缺少付款方式"));
  }

  const normalizedType = payment_type === "card" ? "credit" : payment_type?.toLowerCase();

  if (!supportedTypes.includes(normalizedType)) {
    return next(appError(400, `不支援的付款方式：${payment_type}`));
  }

  // 檢查是否已存在該訂單（避免重複建立付款）
  const existing = await sponsorshipRepo.findOneBy({ order_uuid: order_id });
  if (!existing) {
    return next(appError(404, "查無此訂單"));
  }

  if (existing.payment_status === "paid") {
    return next(appError(400, "此訂單已完成付款，請勿重複操作"));
  }

  // 將 order_id 合併進 body 傳入原 controller
  req.body.orderId = order_id;

  if (normalizedType === "linepay") {
    return handleLinePayRequest(req, res, next);
  }

  if (normalizedType === "credit" || normalizedType === "atm") {
    return createEcpayPayment(req, res, next);
  }

  return next(appError(400, "付款類型處理失敗"));
}

async function getPaymentSuccessInfo(req, res, next) {
  try {
    const { order_id } = req.params;
    const sponsorshipRepo = dataSource.getRepository("Sponsorships");

    const sponsorship = await sponsorshipRepo.findOne({
      where: { order_uuid: order_id },
      relations: ["user", "shipping", "invoice", "invoice.type"]
    });

    if (!sponsorship) {
      return next(appError(404, "找不到訂單資料"));
    }

    if (sponsorship.status !== "paid") {
      return next(appError(400, "此訂單尚未完成付款"));
    }

    const response = {
      orderId: sponsorship.order_uuid,
      transactionId: sponsorship.transaction_id,
      amount: sponsorship.amount,
      paidAt: sponsorship.paid_at,
      paymentMethod: sponsorship.payment_method,
      display_name: sponsorship.display_name,
      email: sponsorship.user?.account || "",
      recipient: sponsorship.shipping?.name || "",
      phone: sponsorship.shipping?.phone || "",
      address: sponsorship.shipping?.address || "",
      note: sponsorship.shipping?.note || ""
    };

    return res.status(200).json({
      status: true,
      message: "付款資料載入成功",
      data: response
    });
  } catch (err) {
    console.error("取得付款成功資料失敗:", err.stack || err);
    return next(appError(500, err.message || "伺服器錯誤"));
  }
}

module.exports = {
  createPaymentRequest,
  getPaymentSuccessInfo
};
