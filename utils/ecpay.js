const crypto = require("crypto");
const qs = require("qs");

function generateCheckMacValue(params, hashKey, hashIV) {
  return generateCheckMacValueWithDebug(params, hashKey, hashIV).mac;
}

function generateCheckMacValueWithDebug(params, hashKey, hashIV) {
  const filteredParams = Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      acc[key] = String(value);
    }
    return acc;
  }, {});

  const sorted = Object.keys(filteredParams)
    .sort((a, b) => a.localeCompare(b, "zh-Hant"))
    .reduce((acc, key) => {
      acc[key] = filteredParams[key];
      return acc;
    }, {});

  const raw = `HashKey=${hashKey}&${qs.stringify(sorted, { encode: false })}&HashIV=${hashIV}`;
  const encoded = encodeURIComponent(raw)
    .toLowerCase()
    .replace(/%20/g, "+")
    .replace(/%21/g, "!")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/%2a/g, "*");

  const mac = crypto.createHash("sha256").update(encoded).digest("hex").toUpperCase();

  return { mac, encoded, raw, sorted };
}

module.exports = {
  generateCheckMacValue,
  generateCheckMacValueWithDebug
};
