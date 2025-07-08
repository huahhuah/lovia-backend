const { sendEmail } = require("./mailer");
const { generateInvoiceNumber } = require("./generateInvoiceNumber");
const { dataSource } = require("../db/data-source"); // 要拿到 repository
const invoiceRepo = dataSource.getRepository("Invoices");

/**
 * 寄送收據通知 Email
 */
async function sendReceiptEmail(sponsorship, invoice) {
  if (!sponsorship || !invoice) {
    console.warn(" 收據通知信缺少必要資料");
    return;
  }

  // 自動補上流水號
  if (!invoice.invoice_no) {
    console.log(" invoice_no 尚未存在，補上流水號");
    await generateInvoiceNumber(invoiceRepo, invoice);
  }

  // 收據類型處理
  const type = invoice?.type?.code || invoice?.type || "unknown";
  let receiptTypeLabel = "收據資訊異常";

  if (type === "email") {
    receiptTypeLabel = "電子收據（寄送 Email）";
  } else if (type === "paper") {
    receiptTypeLabel = "紙本收據（將隨回饋品寄送）";
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
     <p><strong>收據編號：</strong>${invoice.invoice_no}</p>
    <p><strong>開立時間：</strong>${issuedAt}</p>

    <hr/>

    <p><strong>訂單編號：</strong>${sponsorship.order_uuid}</p>
    <p><strong>付款金額：</strong>NT$ ${amountFormatted}</p>
    <p><strong>付款方式：</strong>${sponsorship.payment_method || "LINE Pay"}</p>
    <p><strong>專案名稱：</strong>${projectTitle}</p>

    <br/>
    <p>※ 若您選擇的是 <strong>紙本收據</strong>，正式收據將隨回饋品一同寄送至您填寫的地址。</p>
    <p>此信件僅作為收據已開立之通知，如有疑問，請聯繫客服。</p>
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
