const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Users",
  tableName: "USERS", // PostgreSQL table name 建議用小寫（PostgreSQL 對大小寫敏感）
  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid",
    },
    name: {
      type: "varchar",
      length: 50,
      nullable: false,
    },
    account: {
      type: "varchar",
      length: 320,
      nullable: false,
      unique: true,
    },
    phone: {
      type: "varchar",
      length: 20,
      nullable: false,
    },
    hashed_password: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    avatar_url: {
      type: "varchar",
      length: 2083,
      nullable: true,
    },
    birthday: {
      type: "date",
      nullable: true,
    },
    created_at: {
      type: "timestamp",
      default: () => "CURRENT_TIMESTAMP",
    },
    last_login: {
      type: "timestamp",
      nullable: true,
    },
  },
});
