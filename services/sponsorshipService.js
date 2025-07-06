const { LessThan } = require("typeorm");
const { dataSource } = require("../db/data-source");

async function cancelExpiredPendingSponsorships() {
  const sponsorshipRepo = dataSource.getRepository("Sponsorships");
  const THIRTY_MINUTES_AGO = new Date(Date.now() - 30 * 60 * 1000);

  console.log("=== 開始檢查所有 pending 訂單 ===");
  const allPending = await sponsorshipRepo.find({
    where: { status: "pending" },
    order: { created_at: "ASC" }
  });
  console.log(`目前有 ${allPending.length} 筆 pending 訂單`);
  allPending.forEach(order => {
    console.log(`- [${order.order_uuid}] 建立於 ${order.created_at}`);
  });

  console.log("\n=== 檢查超過 30 分鐘未付款的 pending 訂單 ===");
  const expiredPending = await sponsorshipRepo.find({
    where: {
      status: "pending",
      created_at: LessThan(THIRTY_MINUTES_AGO)
    },
    order: { created_at: "ASC" }
  });
  console.log(`共有 ${expiredPending.length} 筆超時未付款的 pending 訂單`);
  expiredPending.forEach(order => {
    console.log(`- [${order.order_uuid}] 建立於 ${order.created_at}`);
  });

  console.log("\n=== 執行批次更新 ===");
  const result = await sponsorshipRepo.update(
    {
      status: "pending",
      created_at: LessThan(THIRTY_MINUTES_AGO)
    },
    { status: "cancelled" }
  );
  console.log(` 已取消 ${result.affected} 筆逾時未付款訂單`);

  console.log("\n=== 更新後剩餘 pending 訂單 ===");
  const remaining = await sponsorshipRepo.find({
    where: { status: "pending" },
    order: { created_at: "ASC" }
  });
  console.log(`目前還有 ${remaining.length} 筆 pending 訂單`);
}

module.exports = {
  cancelExpiredPendingSponsorships
};
