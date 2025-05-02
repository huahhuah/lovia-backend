const { DataSource } = require("typeorm");
const config = require("../config/index");
const Users = require("../entities/Users.js");
const Projects = require("../entities/Projects.js");
const Categories = require("../entities/Categories.js");
const Genders = require("../entities/Genders.js");
const Roles = require("../entities/Roles.js");
const Statuses = require("../entities/Statuses.js");
const Project_plans = require("../entities/Project_plans.js");
const Proposal = require("../entities/proposal.js");
const sslOption = config.get("db.ssl") ? { rejectUnauthorized: false } : false;

const dataSource = new DataSource({
  type: "postgres",
  host: config.get("db.host"),
  port: config.get("db.port"),
  username: config.get("db.username"),
  password: config.get("db.password"),
  database: config.get("db.database"),
  synchronize: config.get("db.synchronize"),
  poolSize: 10,
  entities: [Users, Projects, Categories, Genders, Roles, Statuses, Project_plans, Proposal],
  ssl: sslOption
});

// 嘗試初始化資料庫連接
dataSource
  .initialize()
  .then(() => {
    console.log("資料庫連接成功");
  })
  .catch(err => {
    console.error("資料庫連接失敗:", err.message);
    console.log(err);
  });

module.exports = { dataSource };
