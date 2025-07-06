require("dotenv").config();
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
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
const jwtSecret = process.env.JWT_SECRET;

/**
 * [1] 建立 LINE Pay 請求
 */
async function handleLinePayRequest({ orderId, amount, email, productName, sponsorship, userId }) {
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
      cancelUrl: `${SITE_URL}/payment/PaymentResult?orderId=`
    }
  };

  const signature = generateLinePaySignature(uri, requestBody, nonce, CHANNEL_SECRET);

  try {
    const response = await axios.post(`${LINEPAY_BASE_URL}${uri}`, requestBody, {
      headers: {
        "Content-Type": "application/json",
        "X-LINE-ChannelId": CHANNEL_ID,
        "X-LINE-Authorization-Nonce": nonce,
        "X-LINE-Authorization": signature
      }
    });

    const paymentUrl = response.data?.info?.paymentUrl?.web;
    if (!paymentUrl) throw new Error("LINE Pay API 回傳錯誤");

    return {
      paymentUrl,
      method: "LINE_PAY"
    };
  } catch (err) {
    console.error("LINE Pay 請求失敗:", err?.response?.data || err);
    throw new Error("建立 LINE Pay 請求失敗");
  }
}

/**
 * [2] LINE Pay 成功導回確認付款
 */
async function handleLinePayConfirm(req, res, next) {
  try {
    const { transactionId, orderId } = req.query;
    if (!transactionId || !orderId) return next(appError(400, "缺少必要參數"));

    const sponsorshipRepo = dataSource.getRepository("Sponsorships");
    const sponsorship = await sponsorshipRepo.findOne({
      where: { order_uuid: orderId },
      relations: ["user", "invoice", "project", "shipping"]
    });
    if (!sponsorship) return next(appError(404, "找不到對應訂單"));

    if (sponsorship.status === "paid" && sponsorship.transaction_id === transactionId) {
      const token = jwt.sign({ id: sponsorship.user.id }, jwtSecret, { expiresIn: "1h" });
      return res.redirect(`${SITE_URL}/checkout/result?orderId=${orderId}&token=${token}`);
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

    sponsorship.status = "paid";
    sponsorship.paid_at = new Date();
    sponsorship.transaction_id = transactionId;
    sponsorship.payment_method = "LINE_PAY";
    sponsorship.payment_result = JSON.stringify(confirmResponse?.data || {});
    await sponsorshipRepo.save(sponsorship);

    // 更新專案金額
    const projectRepo = dataSource.getRepository("Projects");
    const project = await projectRepo.findOneBy({ id: sponsorship.project.id });
    if (project) {
      project.amount += sponsorship.amount;
      await projectRepo.save(project);
    }

    // 保證不寄發票
const invCode =
  ((typeof sponsorship.invoice?.type === "object"
    ? sponsorship.invoice?.type?.code
    : sponsorship.invoice?.type) || "").toLowerCase();

console.log("[LINE Pay] sponsorship.invoice =>", sponsorship.invoice);
console.log("[LINE Pay] 最終 invCode =>", invCode);

await sendSponsorSuccessEmail(sponsorship);

if (invCode === "donate") {
  console.log("[LINE Pay] 捐贈發票，不寄發票信");
} else {
  console.log("[LINE Pay] 寄送發票信");
  await sendInvoiceEmail(sponsorship, sponsorship.invoice);
}




    const token = jwt.sign({ id: sponsorship.user.id }, jwtSecret, { expiresIn: "1h" });
    return res.redirect(`${SITE_URL}/checkout/result?orderId=${orderId}&token=${token}`);
  } catch (err) {
    console.error("LINE Pay Confirm 發生錯誤:", err);
    return res.redirect(`${SITE_URL}/payment/PaymentCancel`);
  }
}

/**
 * [3] 使用者取消付款導回
 */
function handleLinePayCancel(req, res) {
  return res.redirect(`${SITE_URL}/payment/PaymentCancel`);
}

/**
 * [4] 前端查詢付款狀態（避免重複付款）
 */
async function handleClientConfirm(req, res, next) {
  try {
    const { transactionId, orderId } = req.query;
    if (!transactionId || !orderId) return next(appError(400, "缺少必要參數"));

    const sponsorshipRepo = dataSource.getRepository("Sponsorships");
    const sponsorship = await sponsorshipRepo.findOne({
      where: { order_uuid: orderId },
      relations: ["user", "invoice", "project", "shipping"]
    });
    if (!sponsorship) return next(appError(404, "找不到對應訂單"));

    const token = jwt.sign({ id: sponsorship.user.id }, jwtSecret, { expiresIn: "1h" });

    if (sponsorship.status === "paid" && sponsorship.transaction_id === transactionId) {
      console.log("訂單已付款，直接導回結果頁，orderId:", orderId);
      return res.redirect(`${SITE_URL}/checkout/result?orderId=${orderId}&token=${token}`);
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

    sponsorship.status = "paid";
    sponsorship.paid_at = new Date();
    sponsorship.transaction_id = transactionId;
    sponsorship.payment_method = "LINE_PAY";
    sponsorship.payment_result = JSON.stringify(confirmResponse?.data || {});
    await sponsorshipRepo.save(sponsorship);

    // 更新專案金額
    const projectRepo = dataSource.getRepository("Projects");
    const project = await projectRepo.findOneBy({ id: sponsorship.project.id });
    if (project) {
      project.amount += sponsorship.amount;
      await projectRepo.save(project);
    }

    //  保證不寄發票
  const invCode =
  ((typeof sponsorship.invoice?.type === "object"
    ? sponsorship.invoice?.type?.code
    : sponsorship.invoice?.type) || "").toLowerCase();

console.log("[LINE Pay] sponsorship.invoice =>", sponsorship.invoice);
console.log("[LINE Pay] 最終 invCode =>", invCode);

await sendSponsorSuccessEmail(sponsorship);

if (invCode === "donate") {
  console.log("[LINE Pay] 捐贈發票，不寄發票信");
} else {
  console.log("[LINE Pay] 寄送發票信");
  await sendInvoiceEmail(sponsorship, sponsorship.invoice);
}




    console.log("LINE Pay 付款完成，導回前端結果頁");
    return res.redirect(`${SITE_URL}/checkout/result?orderId=${orderId}&token=${token}`);
  } catch (err) {
    console.error("LINE Pay Confirm 發生錯誤:", err);
    return res.redirect(`${SITE_URL}/payment/PaymentCancel`);
  }
}


module.exports = {
  handleLinePayRequest,
  handleLinePayConfirm,
  handleLinePayCancel,
  handleClientConfirm
};
