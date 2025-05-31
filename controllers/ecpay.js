const dayjs = require("dayjs");
const { generateCheckMacValueWithDebug } = require("../utils/ecpay");
const { dataSource } = require("../db/data-source");
const appError = require("../utils/appError");

const MERCHANT_ID = process.env.MERCHANT_ID;
const HASH_KEY = process.env.HASH_KEY;
const HASH_IV = process.env.HASH_IV;
const ECPAY_URL = "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5";

// 建立綠界付款表單
async function createEcPayForm(req, res, next) {
  try {
    const { order_id } = req.params;

    const sponsorshipRepo = dataSource.getRepository("Sponsorships");
    const order = await sponsorshipRepo.findOneBy({ order_uuid: order_id });

    if (!order) {
      return next(appError(404, "找不到訂單"));
    }

    const amount = order.amount;
    const email = order.email;

    const tradeDate = dayjs().format("YYYY/MM/DD HH:mm:ss");
    const merchantTradeNo = order_id.replace(/-/g, "").slice(0, 20);

    const baseParams = {
      MerchantID: MERCHANT_ID,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: tradeDate,
      PaymentType: "aio",
      TotalAmount: String(parseInt(amount, 10)),
      TradeDesc: "LoveiaSponsorship",
      ItemName: "SupportX1",
      ReturnURL: "https://lovia-backend-xl4e.onrender.com/api/v1/ecpay/return",
      ClientBackURL: `https://lovia-frontend.vercel.app/checkout/confirm?order=${order_id}`,
      OrderResultURL: `https://lovia-frontend.vercel.app/checkout/confirm?order=${order_id}`,
      ChoosePayment: "ALL",
      EncryptType: "1",
      Email: email?.trim() || "test@example.com"
    };

    //  使用 debug 函數取得所有資訊
    const debug = generateCheckMacValueWithDebug(baseParams, HASH_KEY, HASH_IV);
    const allParams = { ...baseParams, CheckMacValue: debug.mac };

    //  印出除錯資訊
    console.log(" baseParams：", baseParams);
    console.log(" raw string：", debug.raw);
    console.log(" encoded string：", debug.encoded);
    console.log(" final CheckMacValue：", debug.mac);

    const formHtml = `
      <html>
        <body>
          <form id="ecpay-form" method="POST" action="${ECPAY_URL}">
            ${Object.entries(allParams)
              .map(([key, val]) => `<input type="hidden" name="${key}" value="${val}" />`)
              .join("")}
          </form>
          <script>document.getElementById('ecpay-form').submit();</script>
        </body>
      </html>
    `;

    console.log(" 綠界 HTML 表單產生成功");

    res.send(formHtml);
  } catch (err) {
    console.error(" 綠界建立付款表單錯誤", err);
    next(err);
  }
}

// 綠界 callback 處理
async function handleEcPayReturn(req, res) {
  const data = req.body;
  const sponsorshipRepo = dataSource.getRepository("Sponsorships");

  try {
    const { MerchantTradeNo, RtnCode } = data;

    if (!MerchantTradeNo || !RtnCode) {
      console.error(" 缺少必要參數:", data);
      return res.send("0|缺少參數");
    }

    const sponsorship = await sponsorshipRepo
      .createQueryBuilder("sponsorship")
      .where("REPLACE(sponsorship.order_uuid::text, '-', '') LIKE :prefix", {
        prefix: `${MerchantTradeNo}%`
      })
      .getOne();

    if (!sponsorship) {
      console.error(" 找不到對應訂單:", MerchantTradeNo);
      return res.send("0|訂單不存在");
    }

    if (RtnCode === "1") {
      sponsorship.status = "paid";
      await sponsorshipRepo.save(sponsorship);
      console.log(" 訂單已標記為已付款：", sponsorship.order_uuid);
    } else {
      console.warn("⚠️ 綠界回傳未付款成功：", RtnCode);
    }

    return res.send("1|OK");
  } catch (err) {
    console.error(" 綠界 callback 發生錯誤:", err);
    return res.send("0|處理失敗");
  }
}

module.exports = {
  createEcPayForm,
  handleEcPayReturn
};
