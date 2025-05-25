const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Invoices",
  tableName: "invoices",
  columns: {
    id: {
      primary: true,
      type: "int",
      generated: true
    },
    carrier_code: {
      type: "varchar",
      length: 20,
      nullable: true
    },
    tax_id: {
      type: "varchar",
      length: 10,
      nullable: true
    },
    title: {
      type: "varchar",
      length: 100,
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
      joinColumn: { name: "type_id" },
      eager: true
    }
  }
});
