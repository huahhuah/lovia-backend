const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "ProjectComments",
  tableName: "PROJECT_COMMENTS",
  columns: {
    comment_id: {
      primary: true,
      type: "int",
      generated: "increment"
    },
    content: {
      type: "text",
      nullable: false
    },
    created_at: {
      type: "timestamp",
      createDate: true
    },
    // ✅ 新增欄位：回覆內容
    reply_content: {
      type: "text",
      nullable: true
    },
    // ✅ 新增欄位：回覆時間
    reply_at: {
      type: "timestamp",
      nullable: true
    }
  },
  relations: {
    project: {
      type: "many-to-one",
      target: "Projects",
      joinColumn: { name: "project_id" },
      onDelete: "CASCADE"
    },
    user: {
      type: "many-to-one",
      target: "Users",
      joinColumn: { name: "user_id" },
      onDelete: "CASCADE"
    }
  }
});
