const express = require("express");
const router = express.Router();
const config = require("../config/index");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger");
const projects = require("../controllers/projects");
const auth = require("../middlewares/auth");

router.get("/", projects.getAllProjects);
router.get("/categories", projects.getAllCategories);
router.post("/create", projects.createProject);
router.post("/:id/plans", projects.createProjectPlan);
router.get("/:projectId/plans", projects.getProjectPlans);
router.get("/:projectId/overview", projects.getProjectOverview);
router.get("/:project_id", projects.getProject);
router.put("/:project_id", projects.updateProject);

module.exports = router;
