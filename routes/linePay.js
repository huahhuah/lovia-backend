const express = require("express");
const router = express.Router();
const linePay = require("../controllers/linePay");

// [給前端付款成功頁查詢付款資訊用]
router.post("/linepay/confirm", linePay.handleClientConfirm);

module.exports = router;
