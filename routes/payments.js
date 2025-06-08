const express = require("express");
const router = express.Router();
const { createNewebpayPayment } = require("../controllers/newebpay");

// 藍新付款頁面（產出 HTML 表單並自動送出）
router.post("/users/orders/:order_id/newebpay", createNewebpayPayment);
// 建議清楚掛路徑為 /api/v1/webhooks/payment/callback
//router.post("/payment/callback", handleNewebpayCallback);

module.exports = router;
