const express = require("express");
const router = express.Router();
const config = require("../config/index");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger");
const projects = require("../controllers/projects");

router.get("/:project_id", projects.getProject);

module.exports = router ;