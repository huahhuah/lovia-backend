const express = require("express");
const cors = require("cors");
const path = require("path");
const pinoHttp = require("pino-http");

const logger = require("./utils/logger")("App");
const usersRouter = require("./routes/users");

const app = express();
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

const { router: userRoute } = require('./controllers/users');
app.use('/api',userRoute);

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
  req.log.error(err);
  const statusCode = err.status || 500; // 400, 409, 500 ...
  res.status(statusCode).json({
    status: statusCode === 500 ? "error" : "failed",
    message: err.message || "伺服器錯誤"
  });
});

module.exports = app;
