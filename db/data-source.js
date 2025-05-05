// db/data-source.js
const { DataSource } = require("typeorm");
const config = require("../config/index");

const Users = require("../entities/Users.js");
const Projects = require("../entities/Projects.js");
const Categories = require("../entities/Categories.js");
const Genders = require("../entities/Genders.js");
const Roles = require("../entities/Roles.js");
const Statuses = require("../entities/Statuses.js");
const Project_plans = require("../entities/Project_plans.js");
const CreateProjects = require("../entities/CreateProjects.js");

const isRender = process.env.DATABASE_URL?.includes("render.com");
const sslOption = isRender || config.get("db.ssl") ? { rejectUnauthorized: false } : false;

const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: config.get("db.synchronize"),
  poolSize: 10,
  ssl: sslOption,
  entities: [Users, Projects, Categories, Genders, Roles, Statuses, Project_plans, CreateProjects]
});

module.exports = { dataSource };
