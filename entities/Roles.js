//角色表 : 控制使用者權限，誰可以管理、誰可以提案。
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Roles",
  tableName: "ROLES",
  columns: {
    id: {
      primary: true,
      type: "int",
      generated: "increment"
    },
    role_type: {
      type: "varchar",
      length: 20,
      nullable: false
    }
  },
  relations: {
    users: {
      type: "one-to-many",
      target: "Users",
      inverseSide: "role"
    }
  }
});
