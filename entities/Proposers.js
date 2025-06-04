// 募資者身分轉換成提案者
const { EntitySchema }= require("typeorm")

module.exports = new EntitySchema({
    name: "Proposers",
    tableName: "PROPOSERS",
    columns: {
        user_id:{
            primary: true,
            type: "uuid",
            nullable: false
        },
        url: {
            type: "varchar",
            length: 2083,
            nullable: false
        },
        funding_account: {
            type: "text",
            nullable: false
        },
        status: {
            type: "int",
            default: 1,
            nullable: false
        },
        created_at: {
            type: "date",
            nullable: false
        },
        updated_at: {
            type: "date",
            nullable: true
        }
    },
    relations: {
        user: {
            type:"one-to-one",
            target: "Users",
            joinColumn: { name: "user_id" },
            inverseSide: "proposer"
        },
        proposerStatuses: {
            type: "many-to-one",
            target: "ProposerStatuses",
            joinColumn: { name: "status" },
            inverseSide: "proposers"
        }
    }
});