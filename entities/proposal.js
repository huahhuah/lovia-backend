const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Proposal',
  tableName: 'PROPOSALS', 
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    title: {
      type: 'varchar',
      length: 255,
    },
    summary: {
      type: 'text',
      nullable: true,
    },
    category: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    total_amount: {
      type: 'int',
      nullable: true,
    },
    start_time: {
      type: 'timestamptz',
      nullable: true,
    },
    end_time: {
      type: 'timestamptz',
      nullable: true,
    },
    cover: {
      type: 'text',
      nullable: true,
    },
    full_content: {
      type: 'text',
      nullable: true,
    },
    project_team: {
      type: 'text',
      nullable: true,
    },
    faq: {
      type: 'text',
      nullable: true,
    },
    plan_name: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    amount: {
      type: 'int',
      nullable: true,
    },
    quantity: {
      type: 'int',
      nullable: true,
    },
    feedback: {
      type: 'text',
      nullable: true,
    },
    feedback_img: {
      type: 'text',
      nullable: true,
    },
    delivery_date: {
      type: 'date',
      nullable: true,
    },
    createdAt: {
      type: 'timestamp',
      createDate: true,
    },
    updatedAt: {
      type: 'timestamp',
      updateDate: true,
    },
  },
});