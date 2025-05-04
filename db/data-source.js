const { DataSource } = require("typeorm");
const config = require("../config/index");

const Users = require("../entities/Users");
const Projects = require("../entities/Projects");
const Categories = require("../entities/Categories");
const Genders = require("../entities/Genders");
const Roles = require("../entities/Roles");
const Statuses = require("../entities/Statuses");
const Project_plans = require("../entities/Project_plans");

const dataSource = new DataSource({
  type: "postgres",
  url: config.get("db.url"), // ✅ 改為 url
  synchronize: config.get("db.synchronize"),
  ssl: config.get("db.ssl"),
  entities: [Users, Projects, Categories, Genders, Roles, Statuses, Project_plans]
});

module.exports = { dataSource };
