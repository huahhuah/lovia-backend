// db/data-source.js
const { DataSource } = require("typeorm");
const config = require("../config/index");

const Users = require("../entities/Users");
const Projects = require("../entities/Projects");
const Categories = require("../entities/Categories");
const Genders = require("../entities/Genders");
const Roles = require("../entities/Roles");
const Statuses = require("../entities/Statuses");
const Project_plans = require("../entities/Project_plans");

const isRender = process.env.DATABASE_URL?.includes("render.com");

const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL, // ✅ 改成讀 DATABASE_URL
  synchronize: config.get("db.synchronize"),
  ssl: isRender ? { rejectUnauthorized: false } : false, // ✅ Render 才啟用 SSL
  entities: [Users, Projects, Categories, Genders, Roles, Statuses, Project_plans]
});

module.exports = { dataSource };
