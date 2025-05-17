const{ EntitySchema, JoinColumn } = require("typeorm");

module.exports = new EntitySchema({
    name: "FundUsages",
    tableName: "Fund_usages",
    columns:{
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        progress_id: {
            type:"int",
            nullable: false
        },
        recipient:{
            type: "varchar",
            length: 100,
            nullable: false
        },
        usage: {
            type: "text",
            nullable: false
        },
        amount: {
            type: "int",
            nullable: false
        },
        status_id: {
            type: "int",
            nullable: false
        }
    },
    relations: {
        progress:{
            type: "many-to-one",
            target: "ProjectProgresses",
            joinColumn: { name: "progress_id"},
            inverseSide: "fundUsages"
        },
        status: {
            type: "many-to-one",
            target: "FundUsageStatuses",
            joinColumn: { name: "status_id"},
            inverseSide: "fundUsages"
        }
    }
});