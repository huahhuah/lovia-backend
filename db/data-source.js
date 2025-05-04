const { DataSource } = require("typeorm");
const Users = require("../entities/Users.js");
const Projects = require("../entities/Projects.js");
const Categories = require("../entities/Categories.js");
const Genders = require("../entities/Genders.js");
const Roles = require("../entities/Roles.js");
const Statuses = require("../entities/Statuses.js");
const Project_plans = require("../entities/Project_plans.js");

// 使用 DATABASE_URL（例如從 Render 環境或 .env 載入）
require("dotenv").config(); // 確保 .env 被讀取
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("請確認 .env 中有設定 DATABASE_URL");
}

const dataSource = new DataSource({
  type: "postgres",
  url: DATABASE_URL,
  synchronize: true, // 🚨 正式上線請改為 false，並使用 migration
  ssl: {
    rejectUnauthorized: false
  },
  entities: [Users, Projects, Categories, Genders, Roles, Statuses, Project_plans]
});

module.exports = { dataSource };
