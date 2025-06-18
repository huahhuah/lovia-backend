const express = require("express");
const router = express.Router();
const { createPaymentRequest, getPaymentSuccessInfo } = require("../controllers/orders");
const auth = require("../middlewares/auth");

const { dataSource } = require("../db/data-source");
const userRepository = dataSource.getRepository("Users");
const jwtSecret = process.env.JWT_SECRET;

//  統一金流付款 API
router.post(
  "/users/orders/:order_id/payment",
  auth({ secret: jwtSecret, userRepository }),
  createPaymentRequest
);

router.get(
  "/users/orders/:order_id/payment/success",
  auth({ secret: jwtSecret, userRepository }),
  getPaymentSuccessInfo
);

module.exports = router;
