const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Follows",
    tableName: "FOLLOWS",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: "increment"
        },
        follow:{
            type: "boolean",
            nullable: false
        }
    },
    relations: {
        user:{
            type: "many-to-one",
            target: "Users",
            joinColumn: { name: "user_id" },
            inverseSide: "follows"
        },
        project: {
            type: "many-to-one",
            target: "Projects",
            joinColumn: { name: "project_id" },
            inverseSide: "follows"
        }
    }
})