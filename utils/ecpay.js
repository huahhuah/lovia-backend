const crypto = require("crypto");

const HASH_KEY = process.env.ECPAY_HASH_KEY;
const HASH_IV = process.env.ECPAY_HASH_IV;

function createCheckMacValue(params) {
  const sortedKeys = Object.keys(params).sort();
  const raw =
    `HashKey=${HASH_KEY}&` +
    sortedKeys.map(key => `${key}=${params[key]}`).join("&") +
    `&HashIV=${HASH_IV}`;

  const encoded = encodeURIComponent(raw)
    .toLowerCase()
    .replace(/%20/g, "+")
    .replace(/%21/g, "!")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/%2a/g, "*");

  const hash = crypto.createHash("sha256").update(encoded).digest("hex").toUpperCase();

  // Debug 輸出
  if (process.env.DEBUG_ECPAY === "true") {
    console.log(" [CheckMacValue Debug]");
    console.log(" 排序後原始資料：", params);
    console.log("加密前 raw：", raw);
    console.log(" encodeURIComponent encoded：", encoded);
    console.log("SHA256 CheckMacValue：", hash);
  }

  return hash;
}

/**
 * 建立前端自動送出的表單
 */
function generateEcpayForm(params) {
  const inputs = Object.entries(params)
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`)
    .join("");

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8" /></head>
  <body onload="document.forms[0].submit()">
    <form method="post" action="https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5">
      ${inputs}
    </form>
  </body>
  </html>`;
}

/**
 * ECPay 需要的日期格式
 */
function formatToEcpayDate(date = new Date()) {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const HH = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}/${MM}/${dd} ${HH}:${mm}:${ss}`;
}

module.exports = {
  createCheckMacValue,
  generateEcpayForm,
  formatToEcpayDate
};
