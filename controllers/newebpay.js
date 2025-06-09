const {
  encryptTradeInfo,
  createTradeSha,
  cleanItemDesc,
  decryptTradeInfo
} = require("../utils/newebpay");

const sendMail = require("../utils/sendEmail");
const { dataSource } = require("../db/data-source");
const sponsorshipRepo = dataSource.getRepository("Sponsorships");

// 建立藍新表單
const createNewebpayPayment = async (req, res, next) => {
  const { order_id } = req.params;
  const { amount, email, payment_type, productName } = req.body;

  const itemDesc = cleanItemDesc(productName);
  const merchantOrderNo = order_id.replace(/-/g, "").slice(0, 20);

  const payload = {
    MerchantID: process.env.MERCHANT_ID,
    RespondType: "JSON",
    Version: "2.0",
    TimeStamp: Math.floor(Date.now() / 1000).toString(),
    MerchantOrderNo: merchantOrderNo,
    Amt: amount,
    ItemDesc: itemDesc,
    Email: email,
    ReturnURL: process.env.NEWEBPAY_RETURN_URL,
    NotifyURL: process.env.NEWEBPAY_RETURN_URL,
    ClientBackURL: `${process.env.SITE_URL}/checkout/result?orderId=${order_id}`,
    LoginType: 0,
    EncryptType: 1,
    CREDIT: payment_type === "credit" ? 1 : 0
  };

  const tradeInfo = encryptTradeInfo(payload);
  const tradeSha = createTradeSha(tradeInfo);

  const formHTML = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /></head>
    <body>
      <form id="newebpay-form" method="post" action="${process.env.NEWEBPAY_MPG_URL}">
        <input type="hidden" name="MerchantID" value="${process.env.MERCHANT_ID}" />
        <input type="hidden" name="TradeInfo" value="${tradeInfo}" />
        <input type="hidden" name="TradeSha" value="${tradeSha}" />
        <input type="hidden" name="Version" value="2.0" />
      </form>
      <script>document.getElementById('newebpay-form').submit();</script>
    </body>
    </html>
  `;

  res.send(formHTML);
};

// 接收藍新 callback
const handleNewebpayCallback = async (req, res, next) => {
  try {
    const { TradeInfo } = req.body;
    const data = decryptTradeInfo(TradeInfo);
    console.log("📩 NewebPay callback data:", data);

    const merchantOrderNo = data.MerchantOrderNo;

    const sponsorship = await sponsorshipRepo.findOneBy({
      order_uuid: merchantOrderNo
    });

    if (!sponsorship) {
      console.warn("❌ Sponsorship not found");
      return res.status(404).send("0|FAIL");
    }

    sponsorship.is_paid = true;
    sponsorship.paid_at = new Date();
    await sponsorshipRepo.save(sponsorship);

    await sendMail({
      to: sponsorship.email,
      subject: "感謝您的贊助 🙌",
      html: `<p>親愛的 ${sponsorship.display_name || "贊助者"}，您好：</p>
      <p>我們已收到您 NT$${sponsorship.amount} 的贊助，感謝支持！</p>
      <p>Loveia 募資平台 敬上</p>`
    });

    res.send("1|OK");
  } catch (err) {
    console.error("❌ handleNewebpayCallback error:", err);
    res.status(400).send("0|FAIL");
  }
};

module.exports = { createNewebpayPayment, handleNewebpayCallback };
