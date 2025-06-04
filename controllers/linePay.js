const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { generateLinePaySignature } = require("../utils/linepay");
const { dataSource } = require("../db/data-source");
const appError = require("../utils/appError");

const LINEPAY_BASE_URL = "https://sandbox-api-pay.line.me";
const CHANNEL_ID = process.env.LINEPAY_CHANNEL_ID;
const CHANNEL_SECRET = process.env.LINEPAY_CHANNEL_SECRET;
const SITE_URL = process.env.SITE_URL || "http://localhost:5173";
const CURRENCY = "TWD";

console.log(" CHANNEL_SECRET 傳入簽章前 =", {
  typeof: typeof CHANNEL_SECRET,
  value: CHANNEL_SECRET,
  asString: String(CHANNEL_SECRET)
});

// [1] 建立 LINE Pay 付款請求
async function handleLinePayRequest(req, res, next) {
  try {
    const { amount, email, productName, orderId } = req.body;

    if (!amount || !email || !productName || !orderId) {
      return next(appError(400, "缺少必要欄位"));
    }

    //  額外防呆
    if (
      !CHANNEL_ID ||
      typeof CHANNEL_ID !== "string" ||
      !CHANNEL_SECRET ||
      typeof CHANNEL_SECRET !== "string"
    ) {
      console.error(" CHANNEL 資訊錯誤：", {
        CHANNEL_ID,
        CHANNEL_SECRET,
        type: typeof CHANNEL_SECRET
      });
      return next(appError(500, "LINE Pay 金鑰設定錯誤"));
    }

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
        confirmUrl: `${SITE_URL}/#/payment/linepay/success`,
        cancelUrl: `${SITE_URL}/#/payment/linepay/cancel`
      }
    };

    //  關鍵：強制轉型為字串
    const signature = generateLinePaySignature(uri, requestBody, nonce, String(CHANNEL_SECRET));

    const response = await axios.post(`${LINEPAY_BASE_URL}${uri}`, requestBody, {
      headers: {
        "Content-Type": "application/json",
        "X-LINE-ChannelId": CHANNEL_ID,
        "X-LINE-Authorization-Nonce": nonce,
        "X-LINE-Authorization": signature
      }
    });

    const paymentUrl = response.data?.info?.paymentUrl?.web;
    if (!paymentUrl) {
      return next(appError(500, "LINE Pay 回傳錯誤"));
    }

    return res.status(200).json({
      status: true,
      message: "建立 LINE Pay 付款請求成功",
      data: { payment_url: paymentUrl }
    });
  } catch (err) {
    console.error(" LINE Pay 請求失敗:", err?.response?.data || err.message);
    return next(appError(500, "LINE Pay 請求失敗"));
  }
}

// [2] 接收 LINE Pay 成功付款導回
async function handleLinePayConfirm(req, res, next) {
  try {
    const { transactionId, orderId } = req.query;

    if (!transactionId || !orderId) {
      return next(appError(400, "缺少 transactionId 或 orderId"));
    }

    const uri = `/v3/payments/${transactionId}/confirm`;
    const nonce = uuidv4();

    // 從資料庫查詢訂單
    const sponsorshipRepo = dataSource.getRepository("Sponsorships");
    const sponsorship = await sponsorshipRepo.findOneBy({ order_uuid: orderId });

    if (!sponsorship) {
      return next(appError(404, "找不到對應訂單"));
    }

    const amount = sponsorship.amount;

    const body = { amount, currency: CURRENCY };
    const signature = generateLinePaySignature(uri, body, nonce, String(CHANNEL_SECRET));

    const response = await axios.post(`${LINEPAY_BASE_URL}${uri}`, body, {
      headers: {
        "Content-Type": "application/json",
        "X-LINE-ChannelId": CHANNEL_ID,
        "X-LINE-Authorization-Nonce": nonce,
        "X-LINE-Authorization": signature
      }
    });

    //  更新訂單資訊
    sponsorship.status = "paid";
    sponsorship.paid_at = new Date(); // 記錄付款時間
    sponsorship.transaction_id = transactionId;
    sponsorship.payment_method = "LINE_PAY";

    await sponsorshipRepo.save(sponsorship);

    console.log(" 訂單狀態與付款資訊已更新");

    return res.redirect(
      `${SITE_URL}/#/payment/linepay/success?transactionId=${transactionId}&orderId=${orderId}`
    );
  } catch (err) {
    console.error(" LINE Pay Confirm 發生錯誤", err?.response?.data || err.message);
    return res.redirect(`${SITE_URL}/#/payment/linepay/cancel`);
  }
}

// [3] 使用者取消付款導回
function handleLinePayCancel(req, res) {
  return res.redirect(`${SITE_URL}/transaction-result?status=cancel`);
}

async function handleClientConfirm(req, res, next) {
  try {
    const { transactionId, orderId } = req.body;

    if (!transactionId || !orderId) {
      return res.status(400).json({ status: false, message: "缺少必要參數" });
    }

    const sponsorshipRepo = dataSource.getRepository("Sponsorships");
    const sponsorship = await sponsorshipRepo.findOneBy({ order_uuid: orderId });

    if (!sponsorship) {
      return res.status(404).json({ status: false, message: "找不到訂單" });
    }

    return res.status(200).json({
      status: true,
      info: {
        transactionId,
        transactionStatus: sponsorship.status,
        orderId: sponsorship.order_uuid,
        amount: sponsorship.amount,
        paidAt: sponsorship.paid_at || null,
        paymentMethod: sponsorship.payment_method || "LINE_PAY"
      }
    });
  } catch (err) {
    console.error("handleClientConfirm 發生錯誤:", err);
    return res.status(500).json({ status: false, message: "伺服器錯誤" });
  }
}

module.exports = {
  handleLinePayRequest,
  handleLinePayConfirm,
  handleLinePayCancel,
  handleClientConfirm
};
