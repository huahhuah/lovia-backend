const { LessThan } = require("typeorm");
const { dataSource } = require("../db/data-source");

async function cancelExpiredPendingSponsorships() {
  const sponsorshipRepo = dataSource.getRepository("Sponsorships");
  const THIRTY_MINUTES_AGO = new Date(Date.now() - 30 * 60 * 1000);

  const result = await sponsorshipRepo.update(
    {
      status: "pending",
      created_at: LessThan(THIRTY_MINUTES_AGO)
    },
    { status: "cancelled" }
  );

  console.log(`已取消 ${result.affected} 筆逾時未付款訂單`);
}

module.exports = {
  cancelExpiredPendingSponsorships
};
