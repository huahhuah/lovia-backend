//性別表
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Genders",
  tableName: "GENDERS",
  columns: {
    id: {
      primary: true,
      type: "int",
      generated: "increment"
    },
    gender: {
      type: "varchar",
      length: 10,
      nullable: false
    }
  },
  relations: {
    users: {
      type: "one-to-many",
      target: "Users",
      inverseSide: "gender"
    }
  }
});
