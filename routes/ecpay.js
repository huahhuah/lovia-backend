const express = require("express");
const router = express.Router();
const {
  createEcpayPayment,
  handleEcpayATMInfo,
  handleEcpayCallback
} = require("../controllers/ecpay");

const auth = require("../middlewares/auth");
const { dataSource } = require("../db/data-source");
const userRepository = dataSource.getRepository("Users");
const jwtSecret = process.env.JWT_SECRET;

// 建立付款表單（信用卡或 ATM）
router.post(
  "/users/orders/:orderId/ecpay",
  auth({ secret: jwtSecret, userRepository }),
  createEcpayPayment
);

// ATM 取號通知（ECPay 主動通知）
router.post("/callback/atm", handleEcpayATMInfo);

// 綠界付款完成通知（信用卡或 ATM）
router.post("/ecpay/callback", handleEcpayCallback);

module.exports = router;
