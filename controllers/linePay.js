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
const LINEPAY_BASE_URL = "https://sandbox-api-pay.line.me";

const CHANNEL_ID = process.env.LINEPAY_CHANNEL_ID;
const CHANNEL_SECRET = process.env.LINEPAY_CHANNEL_SECRET;
const CURRENCY = "TWD";

// [1] 使用者點擊付款 → 建立 LINE Pay 請求
async function handleLinePayRequest(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return next(appError(401, "請先登入"));

    const { orderId, amount, email, productName } = req.body;

    if (!orderId || !email || !productName || !Number.isFinite(amount) || amount <= 0) {
      return next(appError(400, "欄位格式不正確"));
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
          id: `pkg_${orderId.slice(0, 10)}`,
          amount,
          products: [{ name: productName, quantity: 1, price: amount }]
        }
      ],
      redirectUrls: {
        confirmUrl: `${BACKEND_URL}/api/v1/linepay/payments/confirm?orderId=${orderId}`,
        cancelUrl: `${SITE_URL}/payment/PaymentCancel`
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
      data: {
        paymentUrl,
        method: "LINE_PAY"
      }
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
const jwt = require("jsonwebtoken"); // 確保已匯入

async function handleLinePayConfirm(req, res, next) {
  try {
    const { transactionId, orderId } = req.query;
    if (!transactionId || !orderId) return next(appError(400, "缺少必要參數"));

    const sponsorshipRepo = dataSource.getRepository("Sponsorships");

    const sponsorship = await sponsorshipRepo.findOne({
      where: { order_uuid: orderId },
      relations: ["user", "invoice", "invoice.type", "project"]
    });

    if (!sponsorship) return next(appError(404, "找不到對應訂單"));

    if (sponsorship.status === "paid" && sponsorship.transaction_id === transactionId) {
      console.info("訂單已付款，跳過更新");

      // 產生新的 JWT token（若 userStore 已遺失）
      const token = jwt.sign({ id: sponsorship.user.id }, process.env.JWT_SECRET, {
        expiresIn: "7d"
      });

      return res.redirect(`${SITE_URL}/checkout/result?orderId=${orderId}&token=${token}`);
    }

    // 發送 Confirm API 給 LINE Pay
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

    // 更新付款資訊
    sponsorship.status = "paid";
    sponsorship.payment_status = "paid";
    sponsorship.paid_at = new Date();
    sponsorship.transaction_id = transactionId;
    sponsorship.payment_method = "LINE Pay";
    sponsorship.payment_result = JSON.stringify(confirmResponse?.data || {});
    await sponsorshipRepo.save(sponsorship);
    console.log(" 訂單狀態已更新為已付款");

    // 更新專案金額
    try {
      const projectRepo = dataSource.getRepository("Projects");
      const project = await projectRepo.findOneBy({ id: sponsorship.project.id });
      if (project) {
        project.amount += sponsorship.amount;
        await projectRepo.save(project);
        console.log(" 專案金額已更新");
      }
    } catch (err) {
      console.error(" 更新專案金額失敗：", err);
    }

    // 寄送通知信 + 發票（非捐贈）
    try {
      const invoiceType = sponsorship.invoice?.type?.name || sponsorship.invoice?.type;
      await Promise.allSettled([
        sendSponsorSuccessEmail(sponsorship),
        invoiceType && invoiceType !== "donate"
          ? sendInvoiceEmail(sponsorship, sponsorship.invoice)
          : Promise.resolve()
      ]);
      console.log(" 通知信與發票處理完成");
    } catch (err) {
      console.error(" 通知寄送失敗：", err.message);
    }

    // 產生 token 並帶入導回網址
    const token = jwt.sign({ id: sponsorship.user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

    return res.redirect(`${SITE_URL}/checkout/result?orderId=${orderId}&token=Bearer%20${token}`);
  } catch (err) {
    console.error("LINE Pay Confirm 錯誤：", err?.response?.data || err.message);
    return res.redirect(`${SITE_URL}/payment/PaymentCancel`);
  }
}

// [3] 取消付款導回
function handleLinePayCancel(req, res) {
  return res.redirect(`${SITE_URL}/payment/PaymentCancel`);
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
