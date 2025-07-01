const { sendEmail } = require("./mailer");
const { sendInvoiceEmail } = require("./sendInvoiceEmail"); // 如果你要直接在這裡也寄發票

/**
 * 寄送贊助成功通知 Email
 */
async function sendSponsorSuccessEmail(sponsorship) {
  if (!sponsorship) {
    console.warn(" 贊助成功通知缺少 sponsorship");
    return;
  }

  const paidAt = new Date(sponsorship.paid_at || Date.now()).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei"
  });

  const amountFormatted = Number(sponsorship.amount || 0).toLocaleString("zh-TW");
  const projectTitle = sponsorship.project?.title || "Lovia 募資專案";
  const email = sponsorship.user?.account || sponsorship.user?.email;
  const isDonate = sponsorship.invoice?.type?.code === "donate";

  console.log(
    ` [EMAIL] 寄送中，isDonate: ${isDonate}, type.code: ${sponsorship.invoice?.type?.code}`
  );

  const subject = isDonate ? "感謝您的愛心捐贈" : "您的 Lovia 贊助已成功！";

  const html = isDonate
    ? `
      <h3>感謝您的愛心捐贈</h3>
      <p>親愛的贊助者，感謝您支持 Lovia 專案！</p>

      <p><strong>訂單編號：</strong>${sponsorship.order_uuid}</p>
      <p><strong>付款金額：</strong>NT$ ${amountFormatted}</p>
      <p><strong>付款方式：</strong>${sponsorship.payment_method || "LINE Pay"}</p>
      <p><strong>付款時間：</strong>${paidAt}</p>
      <p><strong>專案名稱：</strong>${projectTitle}</p>

      <br/>
      <p>您此次發票已全數捐贈給 <strong>財團法人台灣兒童暨家庭扶助基金會
</strong>。</p>
      <p>再次感謝您的愛心與支持，您是世界更美好的力量。</p>
      <p>Lovia 募資平台 敬上</p>
    `
    : `
      <h3>贊助成功通知</h3>
      <p>親愛的贊助者，感謝您支持 Lovia 專案！</p>

      <p><strong>訂單編號：</strong>${sponsorship.order_uuid}</p>
      <p><strong>付款金額：</strong>NT$ ${amountFormatted}</p>
      <p><strong>付款方式：</strong>${sponsorship.payment_method || "LINE Pay"}</p>
      <p><strong>付款時間：</strong>${paidAt}</p>
      <p><strong>專案名稱：</strong>${projectTitle}</p>

      <br/>
      <p>您對專案的每一份支持，都是讓世界更好的力量。</p>
      <p>我們將持續通知您專案進度，並期待未來更多交流。</p>
      <p>Lovia 募資平台 敬上</p>
    `;

  try {
    if (email) {
      await sendEmail({ to: email, subject, html });
      console.log(` [EMAIL] 已寄出給 ${email}`);
    } else {
      console.warn(" 無法寄送通知信，缺少 email");
    }
  } catch (err) {
    console.error(" 通知信寄送失敗:", err.message);
  }

  //  如果非捐贈，要在這裡同時寄發票（就不用在 callback 多呼叫一次）
  if (!isDonate) {
    try {
      await sendInvoiceEmail(sponsorship, sponsorship.invoice);
      console.log(` [INVOICE] 發票已寄出`);
    } catch (err) {
      console.error(" 發票寄送失敗:", err.message);
    }
  } else {
    console.log(" [INVOICE] 此筆為捐贈發票，不寄發票信件。");
  }
}

module.exports = { sendSponsorSuccessEmail };
