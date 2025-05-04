const express = require("express");
const router = express.Router();
const config = require("../config/index");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger");
const projects = require("../controllers/projects");
const auth = require("../middlewares/auth");
const { createproject } = require("../controllers/projects");

router.get("/:project_id", projects.getProject);
router.post("/create", createproject);

module.exports = router ;