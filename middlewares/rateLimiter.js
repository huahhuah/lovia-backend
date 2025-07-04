const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1分鐘
  max: 30, // 暫時測試，1分鐘最多1000次
  message: {
    status: false,
    message: "請求過於頻繁，請稍後再試"
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = limiter;
