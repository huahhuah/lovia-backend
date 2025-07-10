// 提案審查:defaul 1 (1-審查中、2-提案通過、3-提案駁回、4-提案重送)
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "ProjectStatuses",
  tableName: "PROJECT_STATUSES",
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
    projects: {
      type: "one-to-many",
      target: "Projects",
      inverseSide: "projectStatus"
    }
  }
});
