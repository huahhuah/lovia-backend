//  判斷是否為長期贊助（超過 180 天）
function getProjectType(start_time, end_time) {
  const start = new Date(start_time);
  const end = new Date(end_time);

  if (!start || !end || isNaN(start) || isNaN(end)) return "募資中";

  const durationMs = end - start;
  const isLongTerm = durationMs >= 1000 * 60 * 60 * 24 * 180;

  return isLongTerm ? "長期贊助" : "募資中";
}

module.exports = { getProjectType };
