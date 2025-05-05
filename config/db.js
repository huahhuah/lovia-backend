module.exports = (() => {
  const useUrl = !!process.env.DATABASE_URL;

  if (useUrl) {
    // Render or Heroku 等平台注入 DATABASE_URL
    return {
      url: process.env.DATABASE_URL,
      type: "postgres",
      synchronize: process.env.DB_SYNCHRONIZE === "true",
      ssl: process.env.DB_ENABLE_SSL === "true" ? { rejectUnauthorized: false } : false
    };
  }

  // 本地開發模式：用單獨參數
  return {
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_DATABASE || "lovia",
    synchronize: process.env.DB_SYNCHRONIZE === "true",
    ssl: process.env.DB_ENABLE_SSL === "true"
  };
})();
