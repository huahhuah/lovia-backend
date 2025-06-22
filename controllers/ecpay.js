const { createCheckMacValue, generateEcpayForm, formatToEcpayDate } = require("../utils/ecpay");
const { dataSource } = require("../db/data-source");
const { Sponsorships } = require("../entities/Sponsorships");
const { sendSponsorSuccessEmail } = require("../utils/sendSponsorSuccessEmail");
const { sendInvoiceEmail } = require("../utils/sendInvoiceEmail");

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
      TradeDesc: "LoviaSponsorship",
      ItemName: itemName,
      ReturnURL: RETURN_URL,
      ClientBackURL: `${SITE_URL}/checkout/result?orderId=${orderId}`,
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

    // [1] 驗證 CheckMacValue
    const localCMV = createCheckMacValue(data, true);
    if (CheckMacValue !== localCMV) {
      console.warn(" CheckMacValue 驗證失敗", { received: CheckMacValue, expected: localCMV });
      return res.send("0|CHECKMAC_ERROR");
    }

    const {
      MerchantTradeNo,
      RtnCode,
      RtnMsg,
      PaymentDate,
      TradeAmt,
      PaymentType,
      CustomField1: order_uuid
    } = data;

    if (!MerchantTradeNo || !order_uuid) {
      console.warn(" 缺少必要欄位 MerchantTradeNo 或 CustomField1");
      return res.send("0|MISSING_PARAMS");
    }

    const repo = dataSource.getRepository(Sponsorships);
    const order = await repo.findOne({
      where: { order_uuid },
      relations: ["user", "invoice", "invoice.type", "project"]
    });

    if (!order) {
      console.warn(" 找不到對應訂單：", order_uuid);
      return res.send("0|NOT_FOUND");
    }

    if (parseInt(RtnCode) !== 1) {
      console.warn(" 綠界回傳失敗，RtnCode：", RtnCode, "RtnMsg：", RtnMsg);
      return res.send("0|FAIL");
    }

    if (order.status === "paid") {
      console.info("ℹ️ 訂單已標為已付款，略過更新");
      return res.send("1|OK");
    }

    if (parseInt(TradeAmt) !== Math.round(order.amount)) {
      console.warn(` 金額不符：回傳=${TradeAmt}，預期=${order.amount}`);
      return res.send("0|AMOUNT_MISMATCH");
    }

    // [2] 更新付款狀態與資訊
    order.paid_at = dayjs(PaymentDate, "YYYY/MM/DD HH:mm:ss").toDate();
    order.status = "paid";
    order.payment_status = "paid";
    order.payment_method = `綠界 ${PaymentType || "Credit"}`;
    order.transaction_id = MerchantTradeNo;
    order.payment_result = JSON.stringify(req.body);

    await repo.save(order);
    console.log(" 訂單已標示為已付款");

    // [3] 更新專案累積金額
    try {
      const projectRepo = dataSource.getRepository("Projects");
      const project = await projectRepo.findOneBy({ id: order.project.id });
      if (project) {
        project.amount += order.amount;
        await projectRepo.save(project);
        console.log(" 專案金額已更新");
      }
    } catch (err) {
      console.error(" 專案金額更新失敗：", err);
    }

    // [4] 寄送通知信與發票（非捐贈才開立）
    try {
      const invoiceType = order.invoice?.type?.name || order.invoice?.type;
      await Promise.allSettled([
        sendSponsorSuccessEmail(order),
        invoiceType && invoiceType !== "donate"
          ? sendInvoiceEmail(order, order.invoice)
          : Promise.resolve()
      ]);
      console.log(" 通知信與發票處理完成");
    } catch (err) {
      console.error(" 通知或發票處理失敗：", err.message);
    }
    // [5] 建立 JWT token 並 redirect 回前端
    const token = jwt.sign({ id: order.user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

    return res.redirect(`${SITE_URL}/checkout/result?orderId=${order_uuid}&token=${token}`);
  } catch (err) {
    console.error(" 綠界 callback 處理錯誤：", err);
    return res.send("0|SERVER_ERROR");
  }
}

module.exports = {
  createEcpayPayment,
  handleEcpayCallback,
  handleEcpayATMInfo
};
