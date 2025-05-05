const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "CreateProjects",   
  tableName: "CREATEPROJECTS",  
  columns: {
    id: {
      primary: true,
      type: "int",
      generated: "increment"  
    },
    //user_id: {
     // type: "int", //"uuid" 先這樣測試
      //nullable: false  // 這裡設置為不為 NULL，表示必須提供 user_id
    //},
    title: {
        type: 'varchar',
        length: 255,
      },
      summary: {
        type: 'text',
        nullable: true,
      },
      category: {
        type: 'varchar',
        length: 100,
        nullable: true,
      },
      total_amount: {
        type: 'int',
        nullable: true,
      },
      start_time: {
        type: 'timestamptz',
        nullable: true,
      },
      end_time: {
        type: 'timestamptz',
        nullable: true,
      },
      cover: {
        type: 'text',
        nullable: true,
      },
      full_content: {
        type: 'text',
        nullable: true,
      },
      project_team: {
        type: 'text',
        nullable: true,
      },
      faq: {
        type: 'text',
        nullable: true,
      },
      plan_name: {
        type: 'varchar',
        length: 255,
        nullable: true,
      },
      amount: {
        type: 'int',
        nullable: true,
      },
      quantity: {
        type: 'int',
        nullable: true,
      },
      feedback: {
        type: 'text',
        nullable: true,
      },
      feedback_img: {
        type: 'text',
        nullable: true,
      },
      delivery_date: {
        type: 'date',
        nullable: true,
      },
  },
//   relations: {
//     user: {
//       type: "many-to-one",    // 關聯到 Users 表
//       target: "Users",
//       joinColumn: { name: "user_id" },  // 使用 user_id 進行關聯
//       inverseSide: "createProjects"   // 在 Users 表中相對應的關聯名稱
//     },
//     category: {
//       type: "many-to-one",    // 關聯 Categories 表
//       target: "Categories",
//       joinColumn: { name: "category_id" },  // 使用 category_id 進行關聯
//       inverseSide: "createProjects"   // 在 Categories 表中相對應的關聯名稱
//     }
//   }
});