const express = require("express");
const router = express.Router();
const config = require("../config/index");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("Users");
const users = require("../controllers/users");
const linePay = require("../controllers/linePay");

const auth = require("../middlewares/auth")({
  secret: config.get("secret").jwtSecret,
  userRepository: dataSource.getRepository("Users"),
  logger
});

router.post("/signup", users.postSignup);
router.post("/signin", users.postLogin);
router.post("/status", auth, users.postStatus);
router.get("/profile", auth, users.getProfile);
router.patch("/profile", auth, users.patchProfile);
router.post("/projects/:project_id/progress", auth, users.postProgress);
router.put("/:id/password", auth, users.putChangePassword);
router.patch("/projects/:project_id/progress/:progress_id", auth, users.updateProgress);
router.post("/forgot-password", users.sendResetPasswordEmail);
router.post("/reset-password/:token", users.resetPassword);
router.patch("/projects/:project_id/follow", auth, users.toggleFollowStatus);
router.patch("/projects/:project_id/progress/:progress_id", auth, users.updateProgress);
router.patch("/projects/:project_id/follow", auth, users.toggleFollowStatus);

router.put("/:id/password", auth, users.putChangePassword);

// [會員登入後建立付款請求]
router.post("/orders/:orderId/linepay", auth, linePay.handleLinePayRequest);

// [LINE Pay 導回（成功或取消）]
router.get("/linepay/confirm", linePay.handleLinePayConfirm);
router.get("/linepay/cancel", linePay.handleLinePayCancel);

module.exports = router;
