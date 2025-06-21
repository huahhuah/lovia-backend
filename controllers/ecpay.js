const { createCheckMacValue, generateEcpayForm, formatToEcpayDate } = require("../utils/ecpay");
const { dataSource } = require("../db/data-source");
const { Sponsorships } = require("../entities/Sponsorships");
const { sendSponsorSuccessEmail, sendInvoiceEmail } = require("../utils/emailService");

const dayjs = require("dayjs");

const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
const RETURN_URL = process.env.ECPAY_RETURN_URL;
const SITE_URL = process.env.SITE_URL;

// 建立付款頁
async function createEcpayPayment(req, res) {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).send("缺少訂單編號");

    const repo = dataSource.getRepository(Sponsorships);
    const order = await repo.findOne({
      where: { order_uuid: orderId },
      relations: ["plan", "user"]
    });

    if (!order) return res.status(404).send("訂單不存在");
    if (!Number.isFinite(order.amount) || order.amount <= 0)
      return res.status(400).send("金額不合法");

    const now = new Date();
    const tradeNo = "ECPAY" + now.getTime();

    const rawName = (req.body.productName || order.plan?.title || "贊助方案").trim();
    const itemName = rawName
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);

    const paymentType = (req.body.payment_type || "").toLowerCase() === "atm" ? "ATM" : "Credit";

    order.payment_trade_no = tradeNo.slice(0, 20);
    await repo.save(order);

    const params = {
      MerchantID: MERCHANT_ID,
      MerchantTradeNo: tradeNo.slice(0, 20),
      MerchantTradeDate: formatToEcpayDate(now),
      PaymentType: "aio",
      TotalAmount: String(Math.round(order.amount)),
      TradeDesc: encodeURIComponent("LoviaSponsorship"),
      ItemName: itemName,
      ReturnURL: RETURN_URL,
      ClientBackURL: `${SITE_URL}/checkout/result?orderId=${orderId}&method=ecpay`,
      ChoosePayment: paymentType,
      CustomField1: orderId,
      CustomField2: tradeNo,
      CustomField3: order.user?.id || "",
      Email: order.user?.email?.trim() || "test@example.com",
      EncryptType: 1
    };

    if (paymentType === "ATM") {
      params.ExpireDate = 3;
      params.PaymentInfoURL = process.env.ECPAY_PAYMENT_INFO_URL || RETURN_URL;
    }

    params.CheckMacValue = createCheckMacValue(params, true);

    console.log(" 最終送出參數：", params);

    const form = generateEcpayForm(params);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(form);
  } catch (err) {
    console.error(" 建立 ECPay 付款頁失敗：", err);
    res.status(500).send(`建立付款頁失敗：${err.message || "unknown error"}`);
  }
}

// ATM 虛擬帳號通知
async function handleEcpayATMInfo(req, res) {
  try {
    const { MerchantTradeNo, PaymentNo, BankCode, ExpireDate, TradeAmt, CustomField1 } = req.body;

    console.log(" 綠界 ATM 虛擬帳號通知：", req.body);

    if (!MerchantTradeNo || !CustomField1 || !PaymentNo || !BankCode || !ExpireDate) {
      console.warn(" ATM 通知缺少參數：", req.body);
      return res.send("0|MISSING_PARAMS");
    }

    const repo = dataSource.getRepository(Sponsorships);
    const order = await repo.findOneBy({ order_uuid: CustomField1 });

    if (!order) return res.send("0|NOT_FOUND");
    if (order.status === "paid") return res.send("1|ALREADY_PAID");

    if (TradeAmt && parseInt(TradeAmt) !== Math.round(order.amount)) {
      console.warn(" ATM 金額不符：", TradeAmt, "vs", order.amount);
      return res.send("0|AMOUNT_MISMATCH");
    }

    order.payment_method = "ATM";
    order.status = "pending";
    order.transaction_id = MerchantTradeNo;
    order.atm_bank_code = BankCode;
    order.atm_payment_no = PaymentNo;
    order.atm_expire_date = new Date(`${ExpireDate.replace(/\//g, "-")}T23:59:59+08:00`);
    order.payment_result = JSON.stringify(req.body);

    await repo.save(order);
    console.log(" ATM 虛擬帳號資訊已成功寫入");
    return res.send("1|OK");
  } catch (err) {
    console.error(" ATM 處理失敗：", err);
    return res.send("0|SERVER_ERROR");
  }
}

// 付款完成 callback
async function handleEcpayCallback(req, res) {
  try {
    const { CheckMacValue, ...data } = req.body;
    console.log(" [ECPay Callback] 收到資料：", req.body);

    const localCMV = createCheckMacValue(data, true);
    if (CheckMacValue !== localCMV) {
      console.warn(" CheckMacValue 驗證失敗");
      return res.send("0|CHECKMAC_ERROR");
    }

    const { MerchantTradeNo, RtnCode, PaymentDate, TradeAmt, PaymentType, CustomField1 } = data;

    if (!MerchantTradeNo || !CustomField1) {
      console.warn(" 缺少必要欄位");
      return res.send("0|MISSING_PARAMS");
    }

    const repo = dataSource.getRepository(Sponsorships);
    const order = await repo.findOne({
      where: { order_uuid: CustomField1 },
      relations: ["user", "invoice", "invoice.type", "project"]
    });

    if (!order) return res.send("0|NOT_FOUND");
    if (parseInt(RtnCode) !== 1) return res.send("0|FAIL");
    if (order.status === "paid") return res.send("1|OK");

    if (parseInt(TradeAmt) !== Math.round(order.amount)) {
      console.warn(` 金額不符：回傳=${TradeAmt}，預期=${order.amount}`);
      return res.send("0|AMOUNT_MISMATCH");
    }

    order.paid_at = dayjs(PaymentDate, "YYYY/MM/DD HH:mm:ss").toDate();
    order.status = "paid";
    order.payment_method = PaymentType || "ECPAY";
    order.transaction_id = MerchantTradeNo;

    await repo.save(order);
    console.log(" 訂單已標示為已付款");

    try {
      const projectRepo = dataSource.getRepository("Projects");
      const project = await projectRepo.findOneBy({ id: order.project.id });
      if (project) {
        project.amount += order.amount;
        await projectRepo.save(project);
        console.log(" 專案金額已更新");
      }
    } catch (err) {
      console.error(" 更新專案金額失敗：", err);
    }

    try {
      const invoiceType = order.invoice?.type?.name;
      await Promise.allSettled([
        sendSponsorSuccessEmail(order),
        invoiceType && invoiceType !== "donate"
          ? sendInvoiceEmail(order, order.invoice)
          : Promise.resolve()
      ]);
    } catch (err) {
      console.error(" 寄送通知信失敗：", err);
    }

    return res.send("1|OK");
  } catch (err) {
    console.error(" 綠界 callback 錯誤：", err);
    return res.send("0|SERVER_ERROR");
  }
}

module.exports = {
  createEcpayPayment,
  handleEcpayCallback,
  handleEcpayATMInfo
};
