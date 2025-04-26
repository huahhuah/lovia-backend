const { DataSource } = require("typeorm");
const config = require("../config/index");
const User = require("../entities/Users.js");

const dataSource = new DataSource({
  type: "postgres",
  host: config.get("db.host"),
  port: config.get("db.port"),
  username: config.get("db.username"),
  password: config.get("db.password"),
  database: config.get("db.database"),
  synchronize: config.get("db.synchronize"),
  poolSize: 10,
  entities: [User],
  ssl: config.get("db.ssl"),
});

// 嘗試初始化資料庫連接
dataSource
  .initialize()
  .then(() => {
    console.log("資料庫連接成功");
  })
  .catch((err) => {
    console.error("資料庫連接失敗:", err.message);
    console.log(err);
  });

module.exports = { dataSource };
