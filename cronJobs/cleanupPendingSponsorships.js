const cron = require("node-cron");
const { cancelExpiredPendingSponsorships } = require("../services/sponsorship.service");
const logger = require("../utils/logger")("CleanupPendingSponsorships");

function startCleanupPendingSponsorshipsJob() {
  // 每小時第 0 分執行
  cron.schedule("0 * * * *", async () => {
    logger.info(" 啟動每小時清除未付款訂單任務");
    try {
      await cancelExpiredPendingSponsorships();
      logger.info("清除任務完成");
    } catch (err) {
      logger.error(" 清除失敗", err);
    }
  });
}

module.exports = {
  startCleanupPendingSponsorshipsJob
};
