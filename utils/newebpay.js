const crypto = require("crypto");

const HASH_KEY = process.env.HASH_KEY;
const HASH_IV = process.env.HASH_IV;

function cleanItemDesc(desc = "") {
  return (
    (desc || "")
      .replace(/\s+/g, "")
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "")
      .slice(0, 50) || "LoveiaPlan"
  );
}

function stringifyDataForNewebpay(data) {
  return Object.entries(data)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function encryptTradeInfo(data) {
  const query = stringifyDataForNewebpay(data);
  const cipher = crypto.createCipheriv("aes-256-cbc", HASH_KEY, HASH_IV);
  cipher.setAutoPadding(true);
  let encrypted = cipher.update(query, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

function createTradeSha(tradeInfo) {
  const raw = `HashKey=${HASH_KEY}&TradeInfo=${tradeInfo}&HashIV=${HASH_IV}`;
  return crypto.createHash("sha256").update(raw).digest("hex").toUpperCase();
}

module.exports = {
  cleanItemDesc,
  stringifyDataForNewebpay,
  encryptTradeInfo,
  createTradeSha
};
