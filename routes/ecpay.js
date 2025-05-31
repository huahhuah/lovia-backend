const express = require("express");
const router = express.Router();
const { handleEcPayReturn } = require("../controllers/ecpay");

router.post("/return", express.urlencoded({ extended: false }), handleEcPayReturn);

module.exports = router;
