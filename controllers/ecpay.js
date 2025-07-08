// =================== controllers/ecpay.js ======================
// 提供綠界金流相關 API，包括：
//   1. createEcpayPayment - 建立付款頁
//   2. handleEcpayCallback - 處理信用卡 / WebATM 完成付款通知
// ---------------------------------------------------------------

const {
  createCheckMacValue: _cmv,
  generateEcpayForm: _form,
  formatToEcpayDate: _fmt
} = require("../utils/ecpay");

const { dataSource } = require("../db/data-source");
const Sponsorships = require("../entities/Sponsorships");
const Projects = require("../entities/Projects");
const { sendSponsorSuccessEmail } = require("../utils/sendSponsorSuccessEmail");
const { sendReceiptEmail } = require("../utils/sendReceiptEmail");
const dayjs = require("dayjs");
const jwt = require("jsonwebtoken");

const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
const RETURN_URL = process.env.ECPAY_RETURN_URL; // Server‑to‑Server callback
const CLIENT_BACK = process.env.ECPAY_CLIENT_BACK_URL; // 使用者付款完成跳轉

// 建立付款頁（支援 Credit 與 WebATM）
async function createEcpayPayment(req, res) {
  try {
    const { orderId } = req.params;
    const repo = dataSource.getRepository(Sponsorships);
    const order = await repo.findOne({
      where: { order_uuid: orderId },
      relations: ["plan", "user"]
    });

    if (!order) {
      console.warn(" 找不到訂單：", orderId);
      return res.send("0|NOT_FOUND");
    }

    if (!Number.isFinite(order.amount) || order.amount <= 0)
      return res.status(400).send("金額不合法");

    const now = new Date();
    const tradeNo = `ECPAY${now.getTime()}`.slice(0, 20);

    // 商品名稱清洗（移除特殊符號）
    const rawName = (req.body.productName || order.plan?.plan_name || "贊助方案").trim();
    const itemName = rawName
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 100);

    // 支援的付款方式：credit、webatm
    const rawType = (req.body.payment_type || "credit").toLowerCase();
    let payType;

    switch (rawType) {
      case "webatm":
        payType = "WebATM";
        break;
      case "credit":
        payType = "Credit";
        break;
      default:
        return res.status(400).json({ status: "failed", message: `不支援的付款方式: ${rawType}` });
    }

    // 存入交易編號
    order.payment_trade_no = tradeNo;
    await repo.save(order);

    // 組合 ECPay 參數
    const params = {
      MerchantID: MERCHANT_ID,
      MerchantTradeNo: tradeNo,
      MerchantTradeDate: _fmt(now),
      PaymentType: "aio",
      TotalAmount: String(Math.round(order.amount)),
      TradeDesc: "LoviaSponsorship",
      ItemName: itemName,
      ReturnURL: RETURN_URL,
      ClientBackURL: `${CLIENT_BACK}?orderId=${orderId}&method=ecpay`,
      ChoosePayment: payType,
      CustomField1: orderId,
      CustomField2: tradeNo,
      CustomField3: order.user?.id || "",
      Email: order.user?.email?.trim() || "test@example.com",
      EncryptType: 1
    };

    params.CheckMacValue = _cmv(params);

    const form = _form(params);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(form);
  } catch (err) {
    console.error(" createEcpayPayment error:", err);
    res.status(500).send(`建立付款頁失敗：${err.message || "unknown"}`);
  }
}

// 處理付款完成通知（Credit / WebATM）
async function handleEcpayCallback(req, res) {
  try {
    const { CheckMacValue, ...data } = req.body;
    const nowStr = new Date().toISOString();

    // 驗證 CheckMacValue
    if (process.env.DEBUG_ECPAY !== "true" && _cmv(data) !== CheckMacValue) {
      console.warn(" CheckMacValue 驗證失敗");
      return res.send("0|CHECKMAC_ERROR");
    }

    const {
      MerchantTradeNo: tradeNo,
      RtnCode,
      PaymentDate,
      TradeAmt,
      PaymentType,
      CustomField1: orderId
    } = data;

    if (parseInt(RtnCode) !== 1) {
      console.warn(`[${nowStr}]  綠界回傳失敗，RtnCode: ${RtnCode}`);
      return res.send("0|FAIL");
    }

    const repo = dataSource.getRepository(Sponsorships);
    const order = await repo.findOne({
      where: { order_uuid: orderId },
      relations: ["user", "invoice", "invoice.type", "project"]
    });

    if (!order) {
      console.warn(`[${nowStr}]  找不到訂單 ${orderId}`);
      return res.send("0|NOT_FOUND");
    }

    if (order.status === "paid") return res.send("1|OK");

    if (Number(TradeAmt) !== Math.round(order.amount)) {
      console.warn(`[${nowStr}]  金額不符 ${TradeAmt} vs ${order.amount}`);
      return res.send("0|AMOUNT_MISMATCH");
    }

    // 更新付款資訊
    Object.assign(order, {
      paid_at: dayjs(PaymentDate, "YYYY/MM/DD HH:mm:ss").toDate(),
      status: "paid",
      payment_method: `綠界 ${PaymentType || "Credit"}`,
      transaction_id: tradeNo,
      payment_result: JSON.stringify(req.body)
    });
    await repo.save(order);

    // 專案累積金額 + email / invoice 處理
    try {
      const projectRepo = dataSource.getRepository(Projects);
      const project = await projectRepo.findOneBy({ id: order.project.id });
      if (project) {
        project.amount += order.amount;
        await projectRepo.save(project);
      }
    } catch (e) {
      console.error("專案金額累積失敗:", e);
    }

    // 寄送通知與收據
    try {
      console.log(`[${nowStr}] 收據寄送 DEBUG:`, {
        order_uuid: order.order_uuid,
        invoice: order.invoice
      });

      await sendSponsorSuccessEmail(order);
      await sendReceiptEmail(order, order.invoice || {});
    } catch (e) {
      console.error(`[${nowStr}] 寄送收據信失敗:`, e);
    }

    // 讓前端帶 token 可以直接載入付款成功資訊
    try {
      const token = jwt.sign({ id: order.user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
      const redirectUrl = `${CLIENT_BACK}?orderId=${orderId}&token=${token}`;
      if (!res.headersSent) return res.redirect(redirectUrl);
    } catch (e) {
      console.error(`[${nowStr}] 產生 token 或 redirect 失敗:`, e);
    }

    return res.send("1|OK");
  } catch (err) {
    console.error(`[${new Date().toISOString()}]  handleEcpayCallback 錯誤:`, err);
    return res.send("0|SERVER_ERROR");
  }
}

module.exports = {
  createEcpayPayment,
  handleEcpayCallback
};
