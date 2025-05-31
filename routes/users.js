const express = require("express");
const router = express.Router();
const config = require("../config/index");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("Users");
const users = require("../controllers/users");
const ecpay = require("../controllers/ecpay");

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
router.patch("/projects/:project_id/progress/:progress_id", auth, users.updateProgress);
router.patch("/projects/:project_id/follow", auth, users.toggleFollowStatus);

router.put("/:id/password", auth, users.putChangePassword);

//綠界金流整合
router.post("/orders/:order_id/ecpay", auth, ecpay.createEcPayForm);

module.exports = router;
