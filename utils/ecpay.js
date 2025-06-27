// ======================= utils/ecpay.js =======================
// 這段工具程式負責：
//   1. 產生符合綠界規範的 CheckMacValue
//   2. 產生自動送出的付款 FORM
//   3. 將 JS Date 轉成綠界要求的字串格式
// -----------------------------------------------------------------

const crypto = require("crypto");

//  這三個環境變數請在 Render / .env 內確認已正確設定
const HASH_KEY = (process.env.ECPAY_HASH_KEY || "").trim();
const HASH_IV = (process.env.ECPAY_HASH_IV || "").trim();
// 測試環境固定走 staging URL；正式環境請換成 production URL
const ECPAY_URL = "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5";

/**
 * 產生 CheckMacValue（ECpay 官方文件 V5）
 * 流程：
 *   1. 過濾 undefined / null 欄位
 *   2. 依鍵名做 ASC 排序
 *   3. 用 & 串起來後在前後加上 HashKey / HashIV
 *   4. 做完整 URL encode → toLowerCase() → 指定字元還原
 *   5. SHA‑256 → 全轉大寫
 */
function createCheckMacValue(params) {
  if (!HASH_KEY || !HASH_IV) {
    throw new Error(" ECPAY_HASH_KEY / HASH_IV 尚未設定，請檢查環境變數！");
  }

  // 1. 過濾無效欄位
  const filtered = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);

  // 2. 鍵名 a~z 排序
  const sorted = filtered.sort(([a], [b]) => a.localeCompare(b, "en"));

  // 3. 組合原始字串
  const raw =
    `HashKey=${HASH_KEY}&` + sorted.map(([k, v]) => `${k}=${v}`).join("&") + `&HashIV=${HASH_IV}`;

  // 4. URL encode + toLowerCase + 替換
  const encoded = encodeURIComponent(raw)
    .toLowerCase()
    .replace(/%20/g, "+")
    .replace(/%21/g, "!")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/%2a/g, "*");

  // 5. SHA‑256 & toUpperCase
  const checkMacValue = crypto.createHash("sha256").update(encoded).digest("hex").toUpperCase();

  if (process.env.DEBUG_ECPAY === "true") {
    console.log("[ECPAY] ★ CheckMacValue Debug =====================");
    console.log("Sorted Params :", sorted);
    console.log("Raw String    :", raw);
    console.log("Encoded String:", encoded);
    console.log("CheckMacValue :", checkMacValue);
    console.log("=================================================");
  }

  return checkMacValue;
}

/**
 *  產生自動送出的 HTML 表單（付款用）
 * @param {Object} params - ECPay 所需欄位
 * @returns {String} HTML form 字串
 */
function generateEcpayForm(params) {
  const inputs = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}" />`)
    .join("\n");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body>
  <form id="ecpay-form" method="post" action="${ECPAY_URL}">
    ${inputs}
  </form>
  <script>document.getElementById('ecpay-form').submit();</script>
  </body></html>`;
}

/**
 *  格式化 JS Date 成綠界指定格式
 * 格式：yyyy/MM/dd HH:mm:ss
 */
function formatToEcpayDate(d = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

module.exports = {
  createCheckMacValue,
  generateEcpayForm,
  formatToEcpayDate
};
