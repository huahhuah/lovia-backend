const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Invoices",
  tableName: "invoices",
  columns: {
    id: {
      primary: true,
      type: "int",
      generated: "increment"
    },
    type_id: {
      type: "int"
    },
    sponsorship_id: {
      type: "int",
      unique: true
    },
    carrier_code: {
      type: "varchar",
      nullable: true
    },
    tax_id: {
      type: "varchar",
      nullable: true
    },
    title: {
      type: "varchar",
      nullable: true
    }
  },
  relations: {
    sponsorship: {
      type: "one-to-one",
      target: "Sponsorships",
      joinColumn: { name: "sponsorship_id" }
    },
    type: {
      type: "many-to-one",
      target: "InvoiceTypes",
      joinColumn: { name: "type_id" }
    }
  }
});
