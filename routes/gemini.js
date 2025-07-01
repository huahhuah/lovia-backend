const express = require("express");
const { geminiChat } = require("../controllers/geminiController");
const rateLimiter = require("../middlewares/rateLimiter");

const router = express.Router();
router.post("/", rateLimiter, geminiChat);

module.exports = router;
