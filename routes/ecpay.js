const express = require("express");
const router = express.Router();
// 綠界金流 callback 控制器
const { handleEcpayATMInfo, handleEcpayCallback } = require("../controllers/ecpay");

const auth = require("../middlewares/auth");
const { dataSource } = require("../db/data-source");
const userRepository = dataSource.getRepository("Users");
const jwtSecret = process.env.JWT_SECRET;

// 綠界 ATM 回傳虛擬帳號通知（付款前）
router.post("/atm", handleEcpayATMInfo);

// 綠界信用卡付款完成通知（付款後）
router.post("/confirm", handleEcpayCallback);

module.exports = router;
