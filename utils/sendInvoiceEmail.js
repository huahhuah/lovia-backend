const { sendEmail } = require("./mailer");

/**
 * 寄送發票通知 Email
 */
async function sendInvoiceEmail(sponsorship, invoice) {
  if (!sponsorship || !invoice) {
    console.warn(" 發票通知信缺少必要資料");
    return;
  }

  // 發票類型處理
  const type = invoice.type?.type || invoice.type;
  let invoiceTypeLabel = "發票資訊異常";

  if (type === "donate") {
    invoiceTypeLabel = "捐贈發票（不列印）";
  } else if (type === "mobile") {
    invoiceTypeLabel = `個人發票（手機條碼：${invoice.carrier_code}）`;
  } else if (type === "paper") {
    invoiceTypeLabel = invoice.tax_id
      ? `公司發票（統一編號：${invoice.tax_id}）`
      : `個人紙本發票（無統編）`;
  }

  const issuedAt = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  const amountFormatted = Number(sponsorship.amount || 0).toLocaleString("zh-TW");
  const projectTitle = sponsorship.project?.title || "Lovia 募資專案";
  const recipientEmail = sponsorship.user?.account || sponsorship.user?.email;
  const subject = "您的 Lovia 發票已開立";

  const html = `
    <h3>發票已完成開立</h3>
    <p>親愛的贊助者，感謝您支持 Lovia 專案。</p>

    <p><strong>發票類型：</strong>${invoiceTypeLabel}</p>
    <p><strong>發票號碼：</strong>${invoice.invoice_no || "(尚未開立或尚未串接載具平台)"}</p>
    <p><strong>開立時間：</strong>${issuedAt}</p>

    <hr/>

    <p><strong>訂單編號：</strong>${sponsorship.order_uuid}</p>
    <p><strong>付款金額：</strong>NT$ ${amountFormatted}</p>
    <p><strong>付款方式：</strong>${sponsorship.payment_method || "LINE Pay"}</p>
    <p><strong>專案名稱：</strong>${projectTitle}</p>

    <br/>
    <p>※ 此發票為電子發票，不提供紙本（除非申請），亦不可用於報帳。</p>
    <p>如有疑問，請聯繫客服。</p>
    <p>Lovia 募資平台 敬上</p>
  `;

  try {
    if (recipientEmail) {
      await sendEmail({ to: recipientEmail, subject, html });
      console.log(" 發票通知信已寄出");
    } else {
      console.warn(" 找不到收件者 email，無法寄出發票信");
    }
  } catch (err) {
    console.error(" 發票通知信寄送失敗:", err.message);
  }
}

module.exports = { sendInvoiceEmail };
