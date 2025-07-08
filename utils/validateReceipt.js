const appError = require("./appError");

function validateReceipt(receipt = {}, type = "email") {
  const code = typeof receipt.carrier_code === "string" ? receipt.carrier_code.trim() : "";
  const taxId = typeof receipt.tax_id === "string" ? receipt.tax_id.trim() : "";

  console.log(" validateReceipt:", { type, code, taxId });

  if (type === "email") {
    if (code.length > 0 || taxId.length > 0) {
      throw appError(400, "電子收據不應填寫手機條碼或統編");
    }
  }

  if (type === "paper") {
    if (taxId && !/^[0-9]{8}$/.test(taxId)) {
      throw appError(400, "紙本收據的統一編號格式錯誤，應為 8 碼數字");
    }
  }
}

function isValidTaiwanID(id) {
  if (!/^[A-Z][12]\d{8}$/i.test(id)) return false;

  const letters = {
    A: 10,
    B: 11,
    C: 12,
    D: 13,
    E: 14,
    F: 15,
    G: 16,
    H: 17,
    I: 34,
    J: 18,
    K: 19,
    L: 20,
    M: 21,
    N: 22,
    O: 35,
    P: 23,
    Q: 24,
    R: 25,
    S: 26,
    T: 27,
    U: 28,
    V: 29,
    W: 32,
    X: 30,
    Y: 31,
    Z: 33
  };
  id = id.toUpperCase();
  const code = letters[id[0]];
  const n1 = Math.floor(code / 10);
  const n2 = code % 10;
  const nums = [n1, n2, ...id.slice(1).split("").map(Number)];

  const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1];
  const sum = nums.reduce((acc, cur, idx) => acc + cur * weights[idx], 0);

  return sum % 10 === 0;
}

module.exports = {
  validateReceipt,
  isValidTaiwanID
};
