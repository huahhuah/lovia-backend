const {
  encryptTradeInfo,
  createTradeSha,
  cleanItemDesc,
  decryptTradeInfo
} = require("../utils/newebpay");
const sendMail = require("../utils/sendEmail");
const createNewebpayPayment = async (req, res, next) => {
  const { order_id } = req.params;
  const { amount, email, payment_type, productName } = req.body;

  const itemDesc = cleanItemDesc(productName);

  const payload = {
    MerchantID: process.env.MERCHANT_ID,
    RespondType: "JSON",
    Version: "2.0",
    TimeStamp: Math.floor(Date.now() / 1000).toString(),
    MerchantOrderNo: order_id.replace(/-/g, "").slice(0, 20),
    Amt: amount,
    ItemDesc: itemDesc,
    Email: email,
    ReturnURL: process.env.NEWEBPAY_RETURN_URL,
    NotifyURL: process.env.NEWEBPAY_RETURN_URL,
    ClientBackURL: `${process.env.SITE_URL}/checkout/result?orderId=${order_id}`,
    LoginType: 0,
    EncryptType: 1,
    CREDIT: payment_type === "credit" ? 1 : 0
    // ATM or others 可以加這邊
  };

  const tradeInfo = encryptTradeInfo(payload);
  const tradeSha = createTradeSha(tradeInfo);

  const formHTML = `
    <html>
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

async function handleNewebpayCallback(req, res, next) {
  try {
    const { TradeInfo } = req.body;
    const data = decryptTradeInfo(TradeInfo);
    console.log("📩 收到藍新 callback：", data);

    // 可加判斷交易狀態
    if (data.Status !== "SUCCESS") {
      console.warn("交易未成功，不更新資料");
      return res.status(400).send("0|FAIL");
    }

    const merchantOrderNo = data.MerchantOrderNo;

    // 找對應 sponsorship 記錄
    const sponsorship = await sponsorshipRepo.findOneBy({ order_uuid: merchantOrderNo });
    if (!sponsorship) {
      console.warn("找不到對應的 sponsorship");
      return res.status(404).send("0|FAIL");
    }

    // 更新付款狀態
    sponsorship.is_paid = true;
    sponsorship.paid_at = new Date();
    await sponsorshipRepo.save(sponsorship);

    // ✅ 寄出贊助成功通知信
    await sendMail({
      to: sponsorship.email,
      subject: "感謝您完成贊助 🙌",
      html: `
        <p>親愛的 ${sponsorship.display_name || "贊助者"} 您好：</p>
        <p>感謝您對專案的支持，我們已成功收到您 NT$${sponsorship.amount} 元的贊助。</p>
        <p>回饋將於專案結束後寄送給您，如有疑問歡迎與我們聯繫！</p>
        <hr/>
        <p>Loveia 募資平台敬上</p>
      `
    });

    res.send("1|OK");
  } catch (err) {
    console.error("❌ 藍新 callback 處理錯誤：", err);
    res.status(400).send("0|FAIL");
  }
}

module.exports = { createNewebpayPayment, handleNewebpayCallback };
