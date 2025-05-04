module.exports = {
  url: process.env.DATABASE_URL,
  synchronize: process.env.DB_SYNCHRONIZE === "true",
  ssl: process.env.DB_ENABLE_SSL === "true" ? { rejectUnauthorized: false } : false
};
