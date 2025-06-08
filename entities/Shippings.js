const { EntitySchema, JoinColumn } = require("typeorm");

module.exports = new EntitySchema({
  name: "Shippings",
  tableName: "shippings",
  columns: {
    id: {
      primary: true,
      type: "int",
      generated: true
    },
    name: {
      type: "varchar",
      length: 50
    },
    phone: {
      type: "varchar",
      length: 20
    },
    address: {
      type: "text"
    },
    note: {
      type: "text",
      nullable: true
    }
  },
  relations: {
    sponsorship: {
      type: "one-to-one",
      target: "Sponsorships",
      inverseSide: "shipping",
      joinColumn: { name: "sponsorship_id" }
    }
  }
});
