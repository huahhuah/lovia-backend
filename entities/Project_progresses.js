const{ EntitySchema, JoinColumn } = require("typeorm");

module.exports = new EntitySchema({
    name: "ProjectProgresses",
    tableName: "Project_progresses",
    columns:{
        id:{
            primary: true,
            type: "int",
            generated: true
        },
        project_id:{
            type:"int",
            nullable: false
        },
        title:{
            type:"varchar",
            length: 100,
            nullable: false
        },
        date:{
            type: "date",
            nullable: false
        },
        content:{
            type: "text",
            nullable: true
        },
        created_at: {
            type: "timestamp",
            default: () => "CURRENT_TIMESTAMP"
        }
    },
    relations:{
        project:{
            type: "many-to-one",
            target: "Projects",
            joinColumn: {name: "project_id"},
            inverseSide: "progresses"
        },
        fundUsages: {
            type: "one-to-many",
            target: "FundUsages",
            inverseSide: "progress"
        }
    }
});