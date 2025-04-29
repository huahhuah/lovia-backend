//使用者狀態表:管理使用者帳號目前狀態（正常 / 被停權 / 尚未啟用）。
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Statuses",
  tableName: "STATUSES",
  columns: {
    id: {
      primary: true,
      type: "int",
      generated: "increment"
    },
    status: {
      type: "varchar",
      length: 20,
      nullable: false
    }
  },
  relations: {
    users: {
      type: "one-to-many",
      target: "Users",
      inverseSide: "status"
    }
  }
});
