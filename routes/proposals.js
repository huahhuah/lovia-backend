const express = require("express");
const router = express.Router();
const { createProposal } = require("../controllers/proposals");

// 正確的 HTTP method 應該是 POST
router.post("/proposals", createProposal); // 使用 POST 建立提案

module.exports = router;