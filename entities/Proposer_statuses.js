// 募資者身分轉換成提案者的狀態
const { EntitySchema } = require("typeorm")

module.exports = new EntitySchema({
    name: "ProposerStatuses",
    tableName: "PROPOSERSTATUSES",
    columns: {
        id: {
            primary: true,
            type: "int",
            nullable: false
        },
        status_type: {
            type: "varchar",
            length: 20,
            nullable: false
        }
    },
    relations: {
        proposers: {
            type:"one-to-many",
            target: "Proposers",
            joinColumn: { name: "status_type"},
            inverseSide: "prposerStatuses"
        }
    }
})
