const express = require('express');
const router = express.Router();
const sendEmail = require('../services/email');

router.post('/send-email', async (req, res) => {
  try {
    const result = await sendEmail(req.body);
    res.status(200).json({ message: 'Email sent', result });
  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ error: 'Failed to send email', detail: err.message });
  }
});

module.exports = router;
