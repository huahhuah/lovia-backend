const { DataSource } = require("typeorm");
const config = require("../config/index");

const Users = require("../entities/Users");
const Projects = require("../entities/Projects");
const Categories = require("../entities/Categories");
const Genders = require("../entities/Genders");
const Roles = require("../entities/Roles");
const Statuses = require("../entities/Statuses");
const Project_plans = require("../entities/Project_plans");

// 判斷是否存在 DATABASE_URL（Render 環境會提供）
const useUrl = !!process.env.DATABASE_URL;

const dataSource = new DataSource({
  type: "postgres",
  ...(useUrl
    ? {
        url: process.env.DATABASE_URL,
        ssl: config.get("db.ssl")
      }
    : {
        host: config.get("db.host"),
        port: Number(config.get("db.port")),
        username: config.get("db.username"),
        password: config.get("db.password"),
        database: config.get("db.database"),
        ssl: config.get("db.ssl")
      }),
  synchronize: config.get("db.synchronize"),
  entities: [Users, Projects, Categories, Genders, Roles, Statuses, Project_plans]
});

module.exports = { dataSource };
