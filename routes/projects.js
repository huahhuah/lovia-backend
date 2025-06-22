const express = require("express");
const router = express.Router();

const config = require("../config/index");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("Auth");
const projects = require("../controllers/projects");

const auth = require("../middlewares/auth")({
  secret: config.get("secret").jwtSecret,
  userRepository: dataSource.getRepository("Users"),
  logger
});
router.get("/my-questions", auth, projects.getMyAllQuestions);
router.get("/my-projects/questions", auth, projects.getMyProjectsQuestions);
router.get("/", projects.getAllProjects);
router.get("/my-projects", auth, projects.getMyProjects);
router.get("/categories", projects.getAllCategories);
router.post("/create", projects.createProject);
router.post("/:id/plans", projects.createProjectPlan);
router.get("/:projectId/plans", projects.getProjectPlans);
router.get("/:projectId/overview", projects.getProjectOverview);
router.get("/:project_id/progresses", projects.getProgress);
router.post("/:project_id/comments", auth, projects.createProjectComment);
router.post("/:project_id/plans/:plan_id/sponsor", auth, projects.sponsorProjectPlan);
router.post("/:project_id/plans/:plan_id/sponsor-entry", auth, projects.createProjectSponsorship);
router.get("/:project_id/faq", projects.getProjectFaq);
router.get("/:project_id/comments", projects.getProjectComment);
router.put("/:id", auth, projects.updateProject);
router.put("/:project_id/plans/:planId", auth, projects.updateProjectPlan);
router.delete("/:id", auth, projects.deleteProject);
router.post("/comments/:id/reply", auth, projects.replyToProjectComment);

// ⬇️ ⬇️ 最後一個
router.get("/:project_id", projects.getProject); // ← 這行要最後，否則會攔截 "/:project_id/faq" 等
module.exports = router;
