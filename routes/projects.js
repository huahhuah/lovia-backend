const express = require("express");
const router = express.Router();
const config = require("../config/index");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger");
const projects = require("../controllers/projects");
const auth = require("../middlewares/auth");

router.get("/:project_id", projects.getProject);
router.post("/create", projects.createProject);
router.post("/:id/plans", projects.createProjectPlan);

module.exports = router;
