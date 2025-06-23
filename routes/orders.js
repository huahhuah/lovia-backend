const express = require("express");
const router = express.Router();

const {
  createPaymentRequest,
  getPaymentSuccessInfo,
  getMySponsorships,
  getPublicPaymentResult
} = require("../controllers/orders");

const { handleLinePayConfirm } = require("../controllers/linePay");
const { handleEcpayCallback, handleEcpayATMInfo } = require("../controllers/ecpay");

const auth = require("../middlewares/auth");
const { dataSource } = require("../db/data-source");
const userRepository = dataSource.getRepository("Users");
const jwtSecret = process.env.JWT_SECRET;

// 建立付款請求（LINE Pay / 綠界）
router.post("/:orderId/payment", auth({ secret: jwtSecret, userRepository }), createPaymentRequest);

// 付款完成頁（需登入 token 驗證版本）
router.post("/:orderId/payment/success", getPaymentSuccessInfo);
router.get(
  "/:orderId/payment/success",
  auth({ secret: jwtSecret, userRepository }),
  getPaymentSuccessInfo
);

//  無需登入版本（前端付款導回用）
router.post("/:orderId/payment/success/public", getPublicPaymentResult);

// 我的贊助紀錄
router.get("/mine", auth({ secret: jwtSecret, userRepository }), getMySponsorships);

// LINE Pay 成功導回（無需登入）
router.get("/linepay/confirm", handleLinePayConfirm);

// 綠界信用卡或 ATM 回傳付款成功通知（無需登入）
router.post("/ecpay/callback", handleEcpayCallback);

// 綠界 ATM 虛擬帳號通知（無需登入）
router.post("/ecpay/atm-info", handleEcpayATMInfo);

module.exports = router;
