const express = require("express");
const router = express.Router();
const config = require("../config/index");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("Users");
const admins = require("../controllers/Admins");

const auth = require("../middlewares/auth")({
  secret: config.get("secret").jwtSecret,
  userRepository: dataSource.getRepository("Users"),
  logger
});

router.get("/users", auth, admins.getAllUsers);
router.get("/users/:user_id", auth, admins.getUsersInfo);
router.get("/proposerApplication", auth, admins.getProposerApplication);
router.patch("/proposerStatus", auth, admins.patchProposerStatus);
router.get("/projects", auth, admins.getAllProjects);
router.patch("/projects/:projectId", auth, admins.patchProjectStatus);
router.get("/dashboard", auth, admins.getDashboardStats);

module.exports = router;
