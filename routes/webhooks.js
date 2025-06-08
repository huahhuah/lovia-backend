const express = require("express");
const router = express.Router();
const { handleNewebpayCallback } = require("../controllers/newebpay");

router.post("/payment/callback", handleNewebpayCallback);

module.exports = router;
