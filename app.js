const express = require("express");
const cors = require("cors");
const path = require("path");
const pinoHttp = require("pino-http");
const env = require("dotenv").config();

const logger = require("./utils/logger")("App");
const usersRouter = require("./routes/users");
const projectRouter = require("./routes/projects");
const uploadRouter = require("./routes/upload");

const app = express();

//  啟動定時任務（僅 production 執行）
if (process.env.NODE_ENV === "production") {
  try {
    const { startUpdateExpiredProjectsJob } = require("./cronJobs/updateExpiredProjects");
    startUpdateExpiredProjectsJob();
    logger.info(" 已啟動每日專案狀態分類任務 (cron)");
  } catch (err) {
    logger.error(" 無法啟動 cron 任務：", err);
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
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/v1/users", usersRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/uploads", uploadRouter);

app.get("/healthcheck", (req, res) => {
  res.status(200);
  res.send("OK");
});

//404
app.use((req, res, next) => {
  res.status(404).json({
    status: "error",
    message: "無此路由"
  });
  return;
});

// eslint-disable-next-line no-unused-vars
//放在所有路由之後,統一處理錯誤
app.use((err, req, res, next) => {
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
