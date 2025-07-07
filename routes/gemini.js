//AI客服
const express = require("express");
const { geminiChat } = require("../controllers/gemini");
const rateLimiter = require("../middlewares/rateLimiter");

const router = express.Router();
router.post("/", rateLimiter, geminiChat);
router.post("", rateLimiter, geminiChat); 

module.exports = router;
