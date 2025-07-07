const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("ProjectService");
const { getProjectType } = require("../utils/projectType");

async function updateExpiredProjects() {
  const projectRepo = dataSource.getRepository("Projects");

  try {
    // 1. 將過期未結束的專案標記為已結束（排除已分類專案）
    const finishedResult = await projectRepo
      .createQueryBuilder()
      .update()
      .set({ is_finished: true })
      .where("end_time < NOW()::date + interval '1 day'")
      .andWhere("is_finished = false")
      .andWhere("project_type NOT IN ('長期贊助', '歷年專案')")
      .execute();
    logger.info(`標記為已結束的專案數：${finishedResult.affected}`);

    // 2. 將 end_time 為 9999-12-31 的專案分類為長期贊助
    const longTermFixedResult = await projectRepo
      .createQueryBuilder()
      .update()
      .set({ project_type: "長期贊助" })
      .where("end_time = '9999-12-31'")
      .andWhere("project_type != '長期贊助'")
      .execute();
    logger.info(`分類為長期贊助（固定結束時間）的專案數：${longTermFixedResult.affected}`);

    // 3. 將起迄時間差超過 180 天的專案分類為長期贊助
    const longTermDurationResult = await projectRepo
      .createQueryBuilder()
      .update()
      .set({ project_type: "長期贊助" })
      .where("project_type != '長期贊助'")
      .andWhere("is_finished = false")
      .andWhere("end_time - start_time >= interval '180 days'")
      .execute();
    logger.info(`分類為長期贊助（180 天以上）的專案數：${longTermDurationResult.affected}`);

    // 4. 將過期已結束但尚未分類的專案分類為歷年專案
    const archivedResult = await projectRepo
      .createQueryBuilder()
      .update()
      .set({ project_type: "歷年專案" })
      .where("is_finished = true")
      .andWhere("end_time < NOW() - interval '1 day'")
      .andWhere("project_type NOT IN ('長期贊助', '歷年專案')")
      .execute();
    logger.info(`分類為歷年專案的專案數：${archivedResult.affected}`);
  } catch (sqlError) {
    logger.warn("SQL 批次分類失敗，改用逐筆 JS 判斷", sqlError);

    try {
      const allProjects = await projectRepo.find();
      const now = new Date();
      const oneDayAgo = new Date(now);
      oneDayAgo.setDate(now.getDate() - 1);

      for (const project of allProjects) {
        const isFinished = new Date(project.end_time) < oneDayAgo;
        const newType = getProjectType(project.start_time, project.end_time);

        if (project.project_type !== newType || project.is_finished !== isFinished) {
          project.project_type = newType;
          project.is_finished = isFinished;
          await projectRepo.save(project);
        }
      }
      logger.info("使用 getProjectType 成功分類所有專案");
    } catch (fallbackError) {
      logger.error("逐筆分類也失敗", fallbackError);
    }
  }
}

module.exports = {
  updateExpiredProjects
};
