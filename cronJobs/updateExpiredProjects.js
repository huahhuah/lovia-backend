const cron = require("node-cron");
const { updateExpiredProjects } = require("../services/projectService");
const logger = require("../utils/logger")("Scheduler");

function startUpdateExpiredProjectsJob() {
  // 每天凌晨 1 點執行
  cron.schedule("0 1 * * *", async () => {
    logger.info(" 正在執行每日專案狀態更新...");
    try {
      await updateExpiredProjects();
      logger.info(" 專案狀態更新完成");
    } catch (err) {
      logger.error("專案狀態更新失敗：", err);
    }
  });
}

module.exports = { startUpdateExpiredProjectsJob };
