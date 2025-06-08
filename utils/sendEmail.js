const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    // 避免某些 SMTP 憑證不被信任導致失敗
    rejectUnauthorized: false
  },
  // 最長 10 秒 timeout
  connectionTimeout: 10000
});

/**
 * 寄送 email（支援 html）
 * @param {Object} options - 寄信參數
 * @param {string} options.to - 收件人
 * @param {string} options.subject - 主旨
 * @param {string} [options.text] - 純文字內容
 * @param {string} [options.html] - HTML 內容
 */
async function sendEmail({ to, subject, text, html }) {
  if (!to || !subject || (!text && !html)) {
    console.warn("發送 email 時缺少必要欄位：to / subject / content");
    return;
  }

  try {
    await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || "Lovia 募資平台"}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html
    });
    console.log(" 已寄出 email 給：", to);
  } catch (err) {
    console.error("寄信失敗：", err);
    throw err; // 若需中斷流程就拋出
  }
}

module.exports = { sendEmail };
