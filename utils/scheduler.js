const cron = require("node-cron");
const { updateExpiredProjects } = require("./services/projectService");
const logger = require("./utils/logger")("Scheduler");

//  每天凌晨 2 點執行一次
cron.schedule("0 2 * * *", async () => {
  logger.info(" 啟動每日專案狀態更新任務");
  try {
    await updateExpiredProjects();
    logger.info(" 更新任務完成");
  } catch (err) {
    logger.error(" 更新專案狀態時出錯", err);
  }
});
