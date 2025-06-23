const express = require("express");
const router = express.Router();
const linePay = require("../controllers/linePay");
const auth = require("../middlewares/auth");
/**
 * [GET] 使用者從 LINE Pay 成功付款後的導回網址
 * - 對應 LINE Pay 的 confirmUrl 設定
 * - URL 範例: /api/v1/linepay/payments/confirm?transactionId=xxx&orderId=xxx
 */

// 使用者從 LINE Pay 導回（付款成功）
router.get("/payments/confirm", linePay.handleLinePayConfirm);

module.exports = router;
