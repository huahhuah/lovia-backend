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
const linePayRoutes = require("./routes/linePay");
const geminiRouter = require("./routes/gemini");

const app = express();

//  CORS 設定（允許你的前端）
const allowedOrigins = [
  "http://localhost:5173",
  "https://lovia-frontend.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    // 沒有 origin (如 Postman) 也允許
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // 不在白名單
    return callback(new Error("CORS policy: This origin is not allowed"), false);
  },
  credentials: true
}));

// 中介軟體設定
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(pinoHttp({ logger }));

// 靜態檔案（如：公開圖片、logo 等）
app.use(express.static(path.join(__dirname, "public")));

//  僅 production 執行定時任務
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

// API 路由註冊
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/uploads", uploadRouter);
app.use("/api/v1/admins", adminsRouter);
app.use("/api/v1/users/orders", ordersRouter);
app.use("/api/v1", emailRoutes);
app.use("/api/v1/auth", oauthRoutes);
app.use("/api/v1/linepay", linePayRoutes);
app.use("/api/v1/webhooks", webhookRouter);
app.use("/api/v1/gemini-chat", geminiRouter);

// 健康檢查（可供監控系統使用）
app.get("/healthcheck", (req, res) => {
  res.status(200).send("OK");
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "無此路由"
  });
});

// 全域錯誤處理
app.use((err, req, res, _next) => {
  req.log.error(err.message || "No error message");
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    status: statusCode === 500 ? "error" : "failed",
    message: err.message || "伺服器錯誤"
  });
});

module.exports = app;
