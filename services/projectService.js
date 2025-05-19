const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("ProjectService");

async function updateExpiredProjects() {
  const projectRepo = dataSource.getRepository("Projects");

  // 1️⃣ 將已結束的專案標記為「已結束」
  const finishedResult = await projectRepo
    .createQueryBuilder()
    .update()
    .set({ is_finished: true })
    .where("end_time < NOW()")
    .andWhere("is_finished = false")
    .execute();
  logger.info(`已結束專案數：${finishedResult.affected}`);

  // 2️⃣ 將 end_time = '9999-12-31' 的專案分類為「長期贊助」
  const longTermResult = await projectRepo
    .createQueryBuilder()
    .update()
    .set({ project_type: "長期贊助" })
    .where("is_finished = false")
    .andWhere("end_time = '9999-12-31'")
    .andWhere("project_type != '長期贊助'")
    .execute();
  logger.info(`已補分類長期贊助專案數：${longTermResult.affected}`);

  // 3️⃣ 將已結束且非長期贊助的專案分類為「歷年專案」
  const historyResult = await projectRepo
    .createQueryBuilder()
    .update()
    .set({ project_type: "歷年專案" })
    .where("is_finished = true")
    .andWhere("end_time < NOW()")
    .andWhere("end_time != '9999-12-31'")
    .andWhere("project_type != '長期贊助'")
    .andWhere("project_type != '歷年專案'")
    .execute();
  logger.info(`已分類歷年專案數：${historyResult.affected}`);
}
