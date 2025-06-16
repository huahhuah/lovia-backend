/**
 * 募資方案表 :
 * 一個專案可以有很多個募資方案（例如：贊助 500 元拿明信片，贊助 1500 元拿周邊商品）。
   方案會設定金額、說明、以及出貨時間，甚至可以限量。
 */
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "ProjectPlans",
  tableName: "PROJECT_PLANS",
  columns: {
    plan_id: {
      primary: true,
      type: "int",
      generated: "increment"
    },
    project_id: {
      type: "int",
      nullable: false
    },
    plan_name: {
      type: "varchar",
      length: 80,
      nullable: false
    },
    amount: {
      type: "int",
      nullable: false
    },
    quantity: {
      type: "int",
      nullable: true
    },
    feedback: {
      type: "text",
      nullable: false
    },
    feedback_img: {
      type: "varchar",
      length: 2083,
      nullable: true
    },
    delivery_date: {
      type: "date",
      nullable: false
    }
  },
  relations: {
    project: {
      type: "many-to-one",
      target: "Projects",
      joinColumn: { name: "project_id" },
      inverseSide: "projectPlans"
    },
    sponsorships: {
      type: "one-to-many",
      target: "Sponsorships",
      inverseSide: "plan" // 注意：這裡要對應 Sponsorships 裡的 plan
    }
  }
});
