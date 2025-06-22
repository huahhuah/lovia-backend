// 募資專案表
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Projects",
  tableName: "PROJECTS",
  columns: {
    id: {
      primary: true,
      type: "int",
      generated: "increment"
    },
    user_id: {
      type: "uuid",
      nullable: false
    },
    title: {
      type: "varchar",
      length: 80,
      nullable: false
    },
    summary: {
      type: "varchar",
      length: 200,
      nullable: false
    },
    category_id: {
      type: "int",
      nullable: false
    },
    total_amount: {
      type: "int",
      nullable: false
    },

    amount: {
      type: "int",
      nullable: false,
      default: 0
    },
    start_time: {
      type: "date",
      nullable: false
    },
    end_time: {
      type: "date",
      nullable: false
    },
    cover: {
      type: "varchar",
      length: 2083,
      nullable: false
    },
    full_content: {
      type: "text",
      nullable: false
    },
    project_team: {
      type: "text",
      nullable: false
    },
    faq: {
      type: "text",
      nullable: true
    },
    project_type: {
      type: "varchar",
      length: 20,
      default: "募資中"
    },
    is_finished: {
      type: "boolean",
      default: false
    },
    created_at: {
      type: "timestamp",
      default: () => "CURRENT_TIMESTAMP"
    },
    status: {
      type: "int",
      default: 1
    },
    reason: {
      type: "varchar",
      length: 100,
      nullable: true
    }
  },
  relations: {
    user: {
      type: "many-to-one",
      target: "Users",
      joinColumn: { name: "user_id" },
      inverseSide: "projects"
    },
    category: {
      type: "many-to-one",
      target: "Categories",
      joinColumn: { name: "category_id" },
      inverseSide: "projects"
    },
    projectPlans: {
      type: "one-to-many",
      target: "ProjectPlans",
      inverseSide: "project"
    },
    follows: {
      type: "one-to-many",
      target: "Follows",
      inverseSide: "project"
    },
    projectStatus: {
      type: "many-to-one",
      target: "ProjectStatuses",
      joinColumn: { name: "status"},  
      inverseSide: "projects"
    }
  }
});
