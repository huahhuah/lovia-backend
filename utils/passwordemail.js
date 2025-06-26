require('dotenv').config(); // 確保讀取 .env

const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const config = require("config"); // ← 加上這行！

const smtpConfig = config.get('email.smtp');
const frontendUrl = config.get("email.frontendBaseUrl");
const jwtSecret = config.get("jwt.secret");

const transporter = nodemailer.createTransport({
  host: smtpConfig.host,
  port: smtpConfig.port,
  secure: smtpConfig.secure,
  auth: {
    user: smtpConfig.user,
    pass: smtpConfig.pass
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000
});

/**
 * 傳送忘記密碼的 Email（帶有 reset link）
 * @param {Object} user - 使用者資料
 * @param {string} user.id - 使用者 ID
 * @param {string} user.account - 使用者帳號（Email）
 */
async function sendResetPasswordEmail(user) {
  const token = jwt.sign({ id: user.id }, jwtSecret, { expiresIn: "1h" });
  const resetLink = `${frontendUrl}/reset-password/${token}`;

  try {
    await transporter.sendMail({
      from: `"Lovia系統通知" <${smtpConfig.user}>`,
      to: user.account,
      subject: "密碼重設連結",
      html: `
        <p>您好，請點擊以下連結以重設密碼（連結有效時間為 1 小時）：</p>
        <a href="${resetLink}">${resetLink}</a>
      `
    });

    console.log(`✅ 密碼重設信已寄出至：${user.account}`);
  } catch (error) {
    console.error("❌ 寄送密碼重設 Email 失敗：", error);
    throw error;
  }
}

module.exports = {
  sendResetPasswordEmail
};