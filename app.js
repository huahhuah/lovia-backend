require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const pinoHttp = require("pino-http");

const logger = require("./utils/logger")("App");
const usersRouter = require("./routes/users");
const projectRouter = require("./routes/projects");
const uploadRouter = require("./routes/upload");
const adminsRouter = require("./routes/admins");
const ordersRouter = require("./routes/orders");
const webhookRouter = require("./routes/webhooks");
const emailRoutes = require("./routes/email");
const oauthRoutes = require("./routes/oauth");

const app = express();

//  啟動定時任務（僅 production 執行）
if (process.env.NODE_ENV === "production") {
  try {
    const { startUpdateExpiredProjectsJob } = require("./cronJobs/updateExpiredProjects");
    startUpdateExpiredProjectsJob();
    logger.info("已啟動每日專案狀態分類任務");
  } catch (err) {
    logger.error("無法啟動 updateExpiredProjects 任務：", err);
  }

  try {
    const { startCleanupPendingSponsorshipsJob } = require("./cronJobs/cleanupPendingSponsorships");
    startCleanupPendingSponsorshipsJob();
    logger.info("已啟動定期清除未完成贊助任務");
  } catch (err) {
    logger.error("無法啟動 cleanupPendingSponsorships 任務：", err);
  }
}

//  Middleware 設定
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        req.body = req.raw.body;
        return req;
      }
    }
  })
);
// 靜態檔案（如：公開圖片、logo 等）
app.use(express.static(path.join(__dirname, "public")));

// API 路由註冊區
//  使用者相關（註冊、登入、會員資料）
app.use("/api/v1/users", usersRouter);
//  提案、回饋方案、留言等專案相關
app.use("/api/v1/projects", projectRouter);
// 圖片上傳（imgbb、multer）
app.use("/api/v1/uploads", uploadRouter);
//管理者後台功能
app.use("/api/v1/admins", adminsRouter);
// 訂單與付款請求（統一付款入口）
app.use("/api/v1/users/orders", ordersRouter);
// 寄送通知信、發票信
app.use("/api/v1", emailRoutes);
// 第三方登入（如 Google OAuth）
app.use("/api/v1/auth", oauthRoutes);
// 金流 Webhook / Callback
app.use("/api/v1/webhooks", require("./routes/webhooks"));

//  健康檢查（可供監控系統使用）
app.get("/healthcheck", (req, res) => {
  res.status(200);
  res.send("OK");
});

//找不到路由 → 404
app.use((req, res, next) => {
  res.status(404).json({
    status: "error",
    message: "無此路由"
  });
  return;
});

// 全域錯誤處理:放在所有路由之後，統一處理錯誤
app.use((err, req, res, _next) => {
  if (!err) {
    err = new Error("未知錯誤");
  }
  req.log.error(err.message || "No error message");

  const statusCode = err.status || 500; // 400, 409, 500 ...
  res.status(statusCode).json({
    status: statusCode === 500 ? "error" : "failed",
    message: err.message || "伺服器錯誤"
  });
});

module.exports = app;
