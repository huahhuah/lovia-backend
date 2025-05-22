const { EntitySchema } = require("typeorm");
module.exports = new EntitySchema({
  name: "Sponsorships",
  tableName: "SPONSORSHIPS",
  columns: {
    id: {
      primary: true,
      type: "int",
      generated: "increment"
    },
    display_name: {
      type: "varchar",
      length: 50,
      nullable: true
    },
    note: {
      type: "text",
      nullable: true
    },
    quantity: {
      type: "int",
      default: 1
    },
    created_at: {
      type: "timestamp",
      createDate: true
    }
  },
  relations: {
    user: {
      type: "many-to-one",
      target: "Users",
      joinColumn: { name: "user_id" },
      onDelete: "CASCADE"
    },
    project: {
      type: "many-to-one",
      target: "Projects",
      joinColumn: { name: "project_id" },
      onDelete: "CASCADE"
    },
    plan: {
      type: "many-to-one",
      target: "ProjectPlans",
      joinColumn: { name: "plan_id" },
      onDelete: "CASCADE"
    }
  }
});
