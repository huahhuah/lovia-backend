require('dotenv').config();
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REDIRECT_URI,
  GMAIL_REFRESH_TOKEN,
  GMAIL_USER
} = process.env;

const oAuth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });

async function sendEmail({ to, subject, message }) {
  if (!to || !subject || !message) {
    throw new Error('欄位未完整填寫');
  }

  const accessToken = await oAuth2Client.getAccessToken();

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: GMAIL_USER,
      clientId: GMAIL_CLIENT_ID,
      clientSecret: GMAIL_CLIENT_SECRET,
      refreshToken: GMAIL_REFRESH_TOKEN,
      accessToken: accessToken.token,
    },
  });

  const mailOptions = {
    from: GMAIL_USER,
    to,
    subject,
    text: message,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = sendEmail;
