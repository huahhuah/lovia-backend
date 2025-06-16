// db/data-source.js
const { DataSource } = require("typeorm");
const config = require("../config/index");

const Users = require("../entities/Users.js");
const Projects = require("../entities/Projects.js");
const Categories = require("../entities/Categories.js");
const Genders = require("../entities/Genders.js");
const Roles = require("../entities/Roles.js");
const Statuses = require("../entities/Statuses.js");
const Project_plans = require("../entities/Project_plans.js");
const ProjectProgress = require("../entities/Project_progresses.js");
const FundUsage = require("../entities/Fund_usages.js");
const FundUsageStatus = require("../entities/Fund_usages_statuses.js");
const ProjectComments = require("../entities/Project_comments.js");
const Sponsorships = require("../entities/Sponsorships.js");
const Shippings = require("../entities/Shippings.js");
const Invoices = require("../entities/Invoices.js");
const InvoiceTypes = require("../entities/InvoiceTypes.js");
const Follows = require("../entities/Follows.js");
const Proposers = require("../entities/Proposers.js");
const ProposerStatuses = require("../entities/Proposer_statuses.js");

const isRender = process.env.DATABASE_URL?.includes("render.com");
const sslOption = isRender || config.get("db.ssl") ? { rejectUnauthorized: false } : false;

const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: config.get("db.synchronize"),
  poolSize: 10,
  ssl: sslOption,
  entities: [
    Users,
    Projects,
    Categories,
    Genders,
    Roles,
    Statuses,
    Project_plans,
    ProjectProgress,
    FundUsage,
    FundUsageStatus,
    ProjectComments,
    Sponsorships,
    Shippings,
    Invoices,
    InvoiceTypes,
    Follows,
    Proposers,
    ProposerStatuses
  ]
});

module.exports = { dataSource };
