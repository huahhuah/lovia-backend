const express = require("express");
const router = express.Router();
const { googleCallback } = require("../controllers/oauth");

router.get("/google/callback", googleCallback);
module.exports = router;
