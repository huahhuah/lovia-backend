require("dotenv").config();
const axios = require("axios");

(async () => {
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: "請寫個冷笑話" }]
          }
        ]
      }
    );
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(JSON.stringify(err.response?.data || err.message, null, 2));
  }
})();
