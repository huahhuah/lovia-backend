const express = require("express");
const router = express.Router();
const config = require("../config/index");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("Users");
const users = require("../controllers/users");
const auth = require("../middlewares/auth")({
  secret: config.get("secret").jwtSecret,
  userRepository: dataSource.getRepository("User"),
  logger,
});

router.post("/signup", users.postSignup);
router.post("/login", users.postLogin);
router.get("/profile", auth, users.getProfile);
router.get("/credit-package", auth, users.getCreditPackage);
router.put("/profile", auth, users.putProfile);
router.put("/password", auth, users.putPassword);
router.get("/courses", auth, users.getCourseBooking);

module.exports = router;
