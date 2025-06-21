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

// 綠界 ATM 虛擬帳號通知
async function handleEcpayATMInfo(req, res) {
  try {
    const {
      MerchantTradeNo,
      PaymentNo,
      BankCode,
      ExpireDate,
      TradeAmt,
      CustomField1 // order_uuid
    } = req.body;

    console.log(" 綠界 ATM 虛擬帳號通知：", req.body);

    // 確保必要欄位存在
    if (!MerchantTradeNo || !CustomField1 || !PaymentNo || !BankCode || !ExpireDate) {
      console.warn(" ATM 通知缺少參數：", req.body);
      return res.send("0|MISSING_PARAMS");
    }

    const repo = dataSource.getRepository("Sponsorships");
    const order = await repo.findOneBy({ order_uuid: CustomField1 });

    if (!order) {
      console.warn(" 找不到對應訂單：", CustomField1);
      return res.send("0|NOT_FOUND");
    }

    if (order.status === "paid") {
      console.log(" 該訂單已付款，略過 ATM 虛擬帳號通知");
      return res.send("1|ALREADY_PAID");
    }

    // 可選：比對金額
    if (TradeAmt && parseInt(TradeAmt) !== Math.round(order.amount)) {
      console.warn(" ATM 金額不符：", TradeAmt, "vs", order.amount);
      return res.send("0|AMOUNT_MISMATCH");
    }

    // 寫入 ATM 虛擬帳號資訊
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
    console.error(" ATM 虛擬帳號處理錯誤：", err);
    return res.send("0|SERVER_ERROR");
  }
}

//綠界callback
async function handleEcpayCallback(req, res) {
  try {
    const { CheckMacValue, ...data } = req.body;
    console.log(" [ECPay Callback] 收到資料：", req.body);

    // [1] 驗證 CheckMacValue
    const localCMV = createCheckMacValue(data, true);
    if (CheckMacValue !== localCMV) {
      console.warn(" CheckMacValue 驗證失敗");
      return res.send("0|CHECKMAC_ERROR");
    }

    const {
      MerchantTradeNo,
      RtnCode,
      PaymentDate,
      TradeAmt,
      PaymentType,
      CustomField1 // order_uuid
    } = data;

    if (!MerchantTradeNo || !CustomField1) {
      console.warn(" 缺少 MerchantTradeNo 或 CustomField1");
      return res.send("0|MISSING_PARAMS");
    }

    // [2] 查找訂單
    const repo = dataSource.getRepository("Sponsorships");
    const order = await repo.findOne({
      where: { order_uuid: CustomField1 },
      relations: ["user", "invoice", "invoice.type", "project"]
    });

    if (!order) {
      console.warn(" 找不到對應訂單：", CustomField1);
      return res.send("0|NOT_FOUND");
    }

    // [3] 驗證是否付款成功
    if (parseInt(RtnCode) !== 1) {
      console.warn(" 綠界回傳交易失敗：RtnCode =", RtnCode);
      return res.send("0|FAIL");
    }

    // [4] 若已付款則略過
    if (order.status === "paid") {
      console.log(" 該訂單已標示為已付款，略過");
      return res.send("1|OK");
    }

    // [5] 驗證金額一致
    if (parseInt(TradeAmt) !== Math.round(order.amount)) {
      console.warn(` 金額不符：回傳=${TradeAmt}，預期=${order.amount}`);
      return res.send("0|AMOUNT_MISMATCH");
    }

    // [6] 更新訂單為已付款
    order.paid_at = dayjs(PaymentDate, "YYYY/MM/DD HH:mm:ss").toDate();
    order.status = "paid";
    order.payment_method = PaymentType || "ECPAY";
    order.transaction_id = MerchantTradeNo;

    await repo.save(order);
    console.log(" 已更新訂單狀態為 paid");

    // [7] 專案金額累加
    try {
      const projectRepo = dataSource.getRepository("Projects");
      const project = await projectRepo.findOneBy({ id: order.project.id });
      if (project) {
        project.amount += order.amount;
        await projectRepo.save(project);
        console.log(" 已累加專案贊助金額");
      }
    } catch (err) {
      console.error(" 累加專案金額失敗：", err);
    }

    // [8] 寄送信件通知
    try {
      const invoiceType = order.invoice?.type?.name;
      await Promise.allSettled([
        sendSponsorSuccessEmail(order),
        invoiceType && invoiceType !== "donate"
          ? sendInvoiceEmail(order, order.invoice)
          : Promise.resolve()
      ]);
    } catch (emailErr) {
      console.error(" 寄送信件失敗：", emailErr);
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
