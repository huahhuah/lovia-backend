#!/usr/bin/env node

/**
 * Module dependencies.
 */
const http = require("http");
const config = require("../config/index");
const app = require("../app");
const logger = require("../utils/logger")("www");
const { dataSource } = require("../db/data-source");

//  全域錯誤捕捉
process.on("uncaughtException", (err) => {
  console.error(" Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error(" Unhandled Rejection:", err);
});


const port = process.env.PORT || config.get("web.port") || 3000;

app.set("port", port);

const server = http.createServer(app);

//  Server 錯誤處理
function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof port === "string" ? `Pipe ${port}` : `Port ${port}`;

  switch (error.code) {
    case "EACCES":
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      logger.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      logger.error(`exception on ${bind}: ${error.code}`);
      process.exit(1);
  }
}

server.on("error", onError);

//  啟動流程
server.listen(port, async () => {
  try {
    console.log(" Server starting...");
    console.log(" PORT:", port);

    //  檢查環境變數
    console.log(
      " DATABASE_URL:",
      process.env.DATABASE_URL ? " 已設定" : " 未設定"
    );

    //  初始化資料庫
    await dataSource.initialize();

    logger.info(" 資料庫連線成功");
    logger.info(` 伺服器運作中. port: ${port}`);
  } catch (error) {
    //  完整錯誤（關鍵）
    console.error(" DB ERROR FULL:", error);

    logger.error(`資料庫連線失敗: ${error.message}`);

    //  不要讓 Render 無聲 crash
    process.exit(1);
  }
});
