const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "FundUsageStatuses",
    tableName: "Fund_usage_statuses",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        code: {
            type: "varchar",
            length: 20,
            nullable: false,
            unique: true
        }
    },
    relations: {
        fundUsages:{
            type: "one-to-many",
            target: "FundUsages",
            inverseSide: "status"
        }
    }
});