const express = require("express");
const router = express.Router();
const { handleEcpayCallback } = require("../controllers/ecpay");

// 綠界信用卡、ATM 成功付款通知
router.post("/ecpay/callback", handleEcpayCallback);

module.exports = router;
