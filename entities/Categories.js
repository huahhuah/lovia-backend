//類別表: 給專案加標籤歸類，方便使用者搜尋。
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Categories",
  tableName: "CATEGORIES",
  columns: {
    id: {
      primary: true,
      type: "int",
      generated: "increment"
    },
    name: {
      type: "varchar",
      length: 20,
      nullable: false
    }
  },
  relations: {
    projects: {
      type: "one-to-many",
      target: "Projects",
      inverseSide: "category"
    }
  }
});
