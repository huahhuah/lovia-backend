const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "InvoiceTypes",
  tableName: "invoice_types",
  columns: {
    id: {
      primary: true,
      type: "int",
      generated: true
    },
    code: {
      type: "varchar",
      length: 20
    },
    label: {
      type: "varchar",
      length: 50
    }
  },
  relations: {
    invoices: {
      type: "one-to-many",
      target: "Invoices",
      inverseSide: "type"
    }
  }
});
