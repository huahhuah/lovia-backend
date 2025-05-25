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
    order_uuid: {
      type: "uuid",
      unique: true,
      generated: "uuid",
      default: () => "uuid_generate_v4()"
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
      nullable: false
    },
    amount: {
      type: "int",
      nullable: false,
      default: 0
    },
    status: {
      type: "enum",
      enum: ["pending", "paid", "cancelled"],
      default: "pending"
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
      eager: true
    },
    project: {
      type: "many-to-one",
      target: "Projects",
      joinColumn: { name: "project_id" },
      eager: true
    },
    plan: {
      type: "many-to-one",
      target: "ProjectPlans",
      joinColumn: { name: "plan_id" },
      eager: true
    },
    shipping: {
      type: "one-to-one",
      target: "Shippings",
      inverseSide: "sponsorship",
      cascade: true,
      onDelete: "CASCADE",
      eager: true
    },
    invoice: {
      type: "one-to-one",
      target: "Invoices",
      inverseSide: "sponsorship",
      cascade: true,
      onDelete: "CASCADE",
      eager: true
    }
  }
});
