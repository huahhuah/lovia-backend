const { sendEmail } = require("./mailer");

/**
 * 寄送收據通知 Email
 */
async function sendReceiptEmail(sponsorship, invoice) {
  if (!sponsorship || !invoice) {
    console.warn(" 收據通知信缺少必要資料");
    return;
  }

  // 收據類型處理
  const type = invoice.type?.code || invoice.type; // 注意改成 .code
  let receiptTypeLabel = "收據資訊異常";

  if (type === "email") {
    receiptTypeLabel = "電子收據（寄送 Email）";
  } else if (type === "paper") {
    receiptTypeLabel = invoice.tax_id
      ? `紙本收據（統一編號：${invoice.tax_id}）`
      : `個人紙本收據（無統編）`;
  }

  const issuedAt = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  const amountFormatted = Number(sponsorship.amount || 0).toLocaleString("zh-TW");
  const projectTitle = sponsorship.project?.title || "Lovia 募資專案";
  const recipientEmail = sponsorship.user?.account || sponsorship.user?.email;
  const subject = "您的 Lovia 收據已開立";

  const html = `
    <h3>收據已完成開立</h3>
    <p>親愛的贊助者，感謝您支持 Lovia 專案。</p>

    <p><strong>收據類型：</strong>${receiptTypeLabel}</p>
    <p><strong>收據編號：</strong>${invoice.invoice_no || "(尚未開立或尚未串接平台)"}</p>
    <p><strong>開立時間：</strong>${issuedAt}</p>

    <hr/>

    <p><strong>訂單編號：</strong>${sponsorship.order_uuid}</p>
    <p><strong>付款金額：</strong>NT$ ${amountFormatted}</p>
    <p><strong>付款方式：</strong>${sponsorship.payment_method || "LINE Pay"}</p>
    <p><strong>專案名稱：</strong>${projectTitle}</p>

    <br/>
    <p>※ 此收據為系統自動開立，如需報帳或紙本請確認您已選擇「紙本收據」。</p>
    <p>如有疑問，請聯繫客服。</p>
    <p>Lovia 募資平台 敬上</p>
  `;

  try {
    if (recipientEmail) {
      await sendEmail({ to: recipientEmail, subject, html });
      console.log(" 收據通知信已寄出");
    } else {
      console.warn(" 找不到收件者 email，無法寄出收據信");
    }
  } catch (err) {
    console.error(" 收據通知信寄送失敗:", err.message);
  }
}

module.exports = { sendReceiptEmail };
