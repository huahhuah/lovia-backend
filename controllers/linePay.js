require("dotenv").config();
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { generateLinePaySignature } = require("../utils/linepay");
const { dataSource } = require("../db/data-source");
const appError = require("../utils/appError");
const { sendSponsorSuccessEmail } = require("../utils/sendSponsorSuccessEmail");
const { sendInvoiceEmail } = require("../utils/sendInvoiceEmail");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";
const SITE_URL = process.env.SITE_URL || "http://localhost:5173";
const LINEPAY_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://sandbox-api-pay.line.me";

const CHANNEL_ID = process.env.LINEPAY_CHANNEL_ID;
const CHANNEL_SECRET = process.env.LINEPAY_CHANNEL_SECRET;
const CURRENCY = "TWD";

// [1] 使用者點擊付款 → 建立 LINE Pay 請求
async function handleLinePayRequest(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return next(appError(401, "請先登入"));

    const { orderId, amount, email, productName } = req.body;
    if (!orderId || !amount || !email || !productName) {
      return next(appError(400, "缺少必要欄位"));
    }

    const sponsorshipRepo = dataSource.getRepository("Sponsorships");
    const sponsorship = await sponsorshipRepo.findOne({
      where: { order_uuid: orderId },
      relations: ["user"]
    });

    if (!sponsorship) return next(appError(404, "找不到該訂單"));
    if (sponsorship.user.id !== req.user.id) return next(appError(403, "無權操作此訂單"));
    if (sponsorship.payment_status === "paid") return next(appError(400, "訂單已付款"));

    const uri = "/v3/payments/request";
    const nonce = uuidv4();

    const requestBody = {
      amount,
      currency: CURRENCY,
      orderId,
      packages: [
        {
          id: uuidv4(),
          amount,
          products: [{ name: productName, quantity: 1, price: amount }]
        }
      ],
      redirectUrls: {
        confirmUrl: `${BACKEND_URL}/api/v1/linepay/payments/confirm?method=linepay`,
        cancelUrl: `${BACKEND_URL}/api/v1/linepay/payments/cancel`
      }
    };

    const signature = generateLinePaySignature(uri, requestBody, nonce, CHANNEL_SECRET);

    const response = await axios.post(`${LINEPAY_BASE_URL}${uri}`, requestBody, {
      headers: {
        "Content-Type": "application/json",
        "X-LINE-ChannelId": CHANNEL_ID,
        "X-LINE-Authorization-Nonce": nonce,
        "X-LINE-Authorization": signature
      }
    });

    const paymentUrl = response.data?.info?.paymentUrl?.web;
    if (!paymentUrl) return next(appError(500, "LINE Pay 回傳錯誤"));

    return res.status(200).json({
      status: true,
      message: "建立付款請求成功",
      data: { paymentUrl }
    });
  } catch (err) {
    console.error("LINE Pay 請求失敗:", {
      response: err?.response?.data,
      message: err.message,
      stack: err.stack
    });
    return next(appError(500, "LINE Pay 請求失敗"));
  }
}

// [2] LINE Pay 付款完成導回 → 後端確認付款
async function handleLinePayConfirm(req, res, next) {
  try {
    const { transactionId, orderId } = req.query;
    if (!transactionId || !orderId) return next(appError(400, "缺少必要參數"));

    const sponsorshipRepo = dataSource.getRepository("Sponsorships");
    const sponsorship = await sponsorshipRepo.findOne({ where: { order_uuid: orderId } });
    if (!sponsorship) return next(appError(404, "找不到對應訂單"));

    if (sponsorship.payment_status === "paid" && sponsorship.transaction_id === transactionId) {
      return res.redirect(
        `${SITE_URL}/#/checkout/result?orderId=${orderId}&transactionId=${transactionId}&method=linepay`
      );
    }

    const uri = `/v3/payments/${transactionId}/confirm`;
    const nonce = uuidv4();
    const confirmBody = { amount: sponsorship.amount, currency: CURRENCY };
    const signature = generateLinePaySignature(uri, confirmBody, nonce, CHANNEL_SECRET);

    const confirmResponse = await axios.post(`${LINEPAY_BASE_URL}${uri}`, confirmBody, {
      headers: {
        "Content-Type": "application/json",
        "X-LINE-ChannelId": CHANNEL_ID,
        "X-LINE-Authorization-Nonce": nonce,
        "X-LINE-Authorization": signature
      }
    });

    sponsorship.payment_status = "paid";
    sponsorship.payment_result = JSON.stringify(confirmResponse?.data || {});
    sponsorship.paid_at = new Date();
    sponsorship.transaction_id = transactionId;
    sponsorship.payment_method = "LINE_PAY";
    await sponsorshipRepo.save(sponsorship);
    await sendSponsorSuccessEmail(sponsorship);

    const invoiceRepo = dataSource.getRepository("Invoices");
    const invoice = await invoiceRepo.findOneBy({ sponsorship_id: sponsorship.id });
    if (invoice) await sendInvoiceEmail(sponsorship, invoice);

    const redirectUrl = `${SITE_URL}/#/checkout/result?orderId=${orderId}&transactionId=${transactionId}&method=linepay`;
    res.redirect(redirectUrl);
  } catch (err) {
    console.error("LINE Pay Confirm 發生錯誤:", err?.response?.data || err.message);
    return res.redirect(`${SITE_URL}/#/payment/PaymentCancel`);
  }
}

// [3] 取消付款導回
function handleLinePayCancel(req, res) {
  return res.redirect(`${SITE_URL}/#/payment/PaymentCancel`);
}

// [4] 查詢付款狀態（前端頁面主動查詢）
async function handleClientConfirm(req, res) {
  try {
    const { transactionId, orderId } = req.body;
    const sponsorshipRepo = dataSource.getRepository("Sponsorships");
    const sponsorship = await sponsorshipRepo.findOneBy({ order_uuid: orderId });

    if (!sponsorship) return res.status(404).json({ status: false, message: "找不到訂單" });
    if (sponsorship.payment_status !== "paid") {
      return res.status(400).json({ status: false, message: "訂單尚未付款" });
    }

    return res.status(200).json({
      status: true,
      info: {
        transactionId,
        transactionStatus: sponsorship.payment_status,
        orderId: sponsorship.order_uuid,
        amount: sponsorship.amount,
        paidAt: sponsorship.paid_at,
        paymentMethod: sponsorship.payment_method
      }
    });
  } catch (err) {
    console.error("handleClientConfirm 錯誤:", err);
    return res.status(500).json({ status: false, message: "伺服器錯誤" });
  }
}

module.exports = {
  handleLinePayRequest,
  handleLinePayConfirm,
  handleLinePayCancel,
  handleClientConfirm
};
