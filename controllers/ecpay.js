const { createCheckMacValue, generateEcpayForm, formatToEcpayDate } = require("../utils/ecpay");
const { dataSource } = require("../db/data-source");
const Sponsorships = require("../entities/Sponsorships");
const { sendSponsorSuccessEmail, sendInvoiceEmail } = require("../utils/emailService");

const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
const RETURN_URL = process.env.ECPAY_RETURN_URL;
const CLIENT_BACK_URL = `${process.env.SITE_URL}/checkout/result`;

//綠界付款
async function createEcpayPayment(req, res) {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).send(" 缺少訂單編號");

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
      ClientBackURL: `${process.env.SITE_URL}/checkout/result?orderId=${orderId}&method=ecpay`,
      ChoosePayment: paymentType,
      CustomField1: orderId,
      CustomField2: tradeNo,
      CustomField3: order.user?.id || "",
      Email: order.user?.email?.trim() || "test@example.com",
      EncryptType: 1
    };

    if (paymentType === "ATM") {
      params.ExpireDate = 3;
      params.PaymentInfoURL = process.env.ECPAY_PAYMENT_INFO_URL || process.env.ECPAY_RETURN_URL;
    }

    params.CheckMacValue = createCheckMacValue(params, true);

    console.log(" 最終送出參數：", params);
    console.log(" 商品名稱 ItemName：", itemName);
    console.log(" CheckMacValue：", params.CheckMacValue);

    const form = generateEcpayForm(params);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(form);
  } catch (err) {
    console.error(" 建立 ECPay 付款頁失敗：", err);
    res.status(500).send(`建立付款頁失敗：${err.message || "unknown error"}`);
  }
}

//AMT
async function handleEcpayATMInfo(req, res) {
  try {
    const { MerchantTradeNo, PaymentNo, BankCode, ExpireDate, CustomField1 } = req.body;
    if (!MerchantTradeNo || !CustomField1 || !PaymentNo || !BankCode || !ExpireDate) {
      console.warn(" ATM 通知缺少參數：", { order_uuid: CustomField1, body: req.body });
      return res.send("0|MISSING_PARAMS");
    }

    const repo = dataSource.getRepository(Sponsorships);
    const order = await repo.findOneBy({ order_uuid: CustomField1 });
    if (!order) return res.send("0|NOT_FOUND");

    if (order.payment_status === "paid") return res.send("1|ALREADY_PAID");

    order.payment_method = "ATM";
    order.payment_status = "pending";
    order.atm_info = {
      bank_code: BankCode,
      payment_no: PaymentNo,
      expire_date: ExpireDate
    };
    order.payment_result = JSON.stringify(req.body);

    await repo.save(order);
    return res.send("1|OK");
  } catch (err) {
    console.error(" ATM 通知處理錯誤：", err);
    return res.send("0|SERVER_ERROR");
  }
}

//綠界callback
async function handleEcpayCallback(req, res) {
  try {
    const {
      MerchantTradeNo,
      RtnCode,
      PaymentDate,
      TradeAmt,
      PaymentType,
      CustomField1 // order_uuid
    } = req.body;

    if (!MerchantTradeNo || !CustomField1) return res.send("0|ERROR");

    const repo = dataSource.getRepository(Sponsorships);

    const order = await repo.findOne({
      where: { order_uuid: CustomField1 },
      relations: ["user", "invoice", "invoice.type", "project"]
    });

    if (!order) return res.send("0|NOT_FOUND");
    if (parseInt(RtnCode) !== 1) return res.send("0|FAIL");
    if (order.status === "paid") return res.send("1|OK");
    if (parseInt(TradeAmt) !== Math.round(order.amount)) return res.send("0|AMOUNT_MISMATCH");

    order.status = "paid";
    order.paid_at = new Date(PaymentDate.replace(" ", "T") || Date.now());
    order.payment_method = PaymentType;
    order.transaction_id = MerchantTradeNo;
    await repo.save(order);

    // 累加至對應專案金額
    const projectRepo = dataSource.getRepository("Projects");
    const project = await projectRepo.findOneBy({ id: order.project.id });
    if (project) {
      project.amount += order.amount;
      await projectRepo.save(project);
    }

    //  寄送信件與發票
    const invoiceType = order.invoice?.type?.name;
    await Promise.allSettled([
      sendSponsorSuccessEmail(order),
      invoiceType && invoiceType !== "donate"
        ? sendInvoiceEmail(order, order.invoice)
        : Promise.resolve()
    ]);

    return res.send("1|OK");
  } catch (err) {
    console.error("綠界付款完成通知錯誤：", err);
    return res.send("0|SERVER_ERROR");
  }
}

module.exports = {
  createEcpayPayment,
  handleEcpayCallback,
  handleEcpayATMInfo
};
