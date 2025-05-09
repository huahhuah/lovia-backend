const express = require("express");
const router = express.Router();
const config = require("../config/index");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger");
const projects = require("../controllers/projects");
const auth = require("../middlewares/auth");

router.post("/create", projects.createProject);
router.post("/:projectId/plans", projects.project_plan);
router.get("/:project_id", projects.getProject);

module.exports = router;
