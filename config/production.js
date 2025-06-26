// config/production.js

module.exports = {
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'your-production-smtp-host',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE === 'true' || true,
      user: process.env.SMTP_USER || 'your-production-smtp-user',
      pass: process.env.SMTP_PASS || 'your-production-smtp-pass',
    },
    frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'https://your-production-frontend-url.com',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-production-jwt-secret',
  },
};
