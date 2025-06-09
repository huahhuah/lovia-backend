const express = require("express");
const router = express.Router();
const linePay = require("../controllers/linePay");
const auth = require("../middlewares/auth");

// [1] 建立 LINE Pay 預約付款請求（需登入）
router.post("/payments/request", auth, linePay.handleLinePayRequest);

// [2] 使用者從 LINE Pay 導回（付款成功）
router.get("/payments/confirm", linePay.handleLinePayConfirm);

// [3] 使用者取消付款
router.get("/payments/cancel", linePay.handleLinePayCancel);

// [4] 前端查詢付款狀態（給結果頁使用）
router.post("/payments/status", linePay.handleClientConfirm);

module.exports = router;
