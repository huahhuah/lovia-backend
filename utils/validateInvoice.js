const appError = require("../utils/appError");

function validateInvoice(invoice = {}, type = "donate") {
  const code = typeof invoice.carrier_code === "string" ? invoice.carrier_code.trim() : "";
  const taxId = typeof invoice.tax_id === "string" ? invoice.tax_id.trim() : "";

  console.log(" validateInvoice:", { type, code, taxId });

  if (type === "donate") {
    if (code.length > 0 || taxId.length > 0) {
      throw appError(400, "捐贈發票不應填寫手機條碼或統編");
    }
  }

  if (type === "mobile") {
    const isValid = /^\/[A-Z0-9]{7}$/i.test(code);
    if (!isValid) {
      throw appError(400, "手機條碼格式錯誤，請輸入以 / 開頭的 8 碼條碼");
    }
  }

  if (type === "paper") {
    if (taxId && !/^[0-9]{8}$/.test(taxId)) {
      throw appError(400, "統一編號格式錯誤，應為 8 碼數字");
    }
  }
}

module.exports = {
  validateInvoice
};
