// 使用者資料表
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Users",
  tableName: "USERS",
  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid"
    },
    username: {
      type: "varchar",
      length: 50,
      nullable: false
    },
    account: {
      type: "varchar",
      length: 255,
      nullable: false,
      unique: true
    },
    phone: {
      type: "varchar",
      length: 20,
      nullable: false
    },
    hashed_password: {
      type: "varchar",
      length: 255,
      nullable: false
    },
    avatar_url: {
      type: "varchar",
      length: 2083,
      nullable: true
    },
    birthday: {
      type: "date",
      nullable: true
    },
    gender_id: {
      type: "int",
      nullable: false
    },
    created_at: {
      type: "timestamp",
      default: () => "CURRENT_TIMESTAMP"
    },
    last_login: {
      type: "timestamp",
      nullable: true
    },
    role_id: {
      type: "int",
      nullable: false
    },
    status_id: {
      type: "int",
      nullable: false
    }
  },
  relations: {
    gender: {
      type: "many-to-one",
      target: "Genders",
      joinColumn: { name: "gender_id" },
      inverseSide: "users"
    },
    role: {
      type: "many-to-one",
      target: "Roles",
      joinColumn: { name: "role_id" },
      inverseSide: "users"
    },
    status: {
      type: "many-to-one",
      target: "Statuses",
      joinColumn: { name: "status_id" },
      inverseSide: "users"
    },
    projects: {
      type: "one-to-many",
      target: "Projects",
      inverseSide: "user"
    }
  }
});
