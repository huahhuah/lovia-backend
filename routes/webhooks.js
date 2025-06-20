const express = require("express");
const router = express.Router();
const { handleEcpayCallback, handleEcpayATMInfo } = require("../controllers/ecpay");

// 綠界信用卡、ATM 成功付款通知
router.post("/ecpay/callback", handleEcpayCallback);

//  若你有開啟 ATM（超商代碼付款）通知
router.post("/ecpay/atm-info", handleEcpayATMInfo);

module.exports = router;
