const { sendEmail } = require("./mailer");

/**
 * 寄送贊助成功通知 Email
 * @param {Object} sponsorship - 贊助資料（含名稱、金額、email/account、訂單編號等）
 */
async function sendSponsorSuccessEmail(sponsorship) {
  if (!sponsorship) {
    console.warn("贊助成功通知缺少 sponsorship");
    return;
  }

  const paidAt = sponsorship.paid_at
    ? new Date(sponsorship.paid_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })
    : new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

  const html = `
    <h3>贊助成功通知</h3>
    <p>親愛的贊助者，感謝您支持 Lovia 專案！</p>

    <p><strong>訂單編號：</strong>${sponsorship.order_uuid}</p>
    <p><strong>付款金額：</strong>NT$ ${sponsorship.amount}</p>
    <p><strong>付款方式：</strong>${sponsorship.payment_method || "LINE Pay"}</p>
    <p><strong>付款時間：</strong>${paidAt}</p>
    <p><strong>專案名稱：</strong>${sponsorship.project_title || "Lovia 募資專案"}</p>

    <br/>
    <p>您對專案的每一份支持，都是讓世界更好的力量。</p>
    <p>我們將持續通知您專案進度，並期待未來更多交流。</p>
    <p>Lovia 募資平台 敬上</p>
  `;

  const email = sponsorship.user?.account;
  const subject = "您的 Lovia 贊助已成功！";

  try {
    if (email) {
      await sendEmail({ to: email, subject, html });
      console.log(" 贊助成功通知信已寄出");
    } else {
      console.warn(" 無法寄送贊助成功通知信，缺少 email");
    }
  } catch (err) {
    console.error("通知信寄送失敗", err.message);
  }
}

module.exports = { sendSponsorSuccessEmail };
