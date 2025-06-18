const axios = require("axios");
const jwt = require("jsonwebtoken");
const { dataSource } = require("../db/data-source");
const Users = require("../entities/Users");
const { v4: uuidv4 } = require("uuid");

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, JWT_SECRET, FRONTEND_URL } =
  process.env;

async function googleCallback(req, res) {
  const { code } = req.query;

  if (!code) return res.status(400).send("Missing authorization code");

  try {
    // 1. 取得 access_token
    const tokenRes = await axios.post("https://oauth2.googleapis.com/token", null, {
      params: {
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code"
      },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    const access_token = tokenRes.data.access_token;

    // 2. 取得使用者資訊
    const userRes = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { email, name, picture } = userRes.data;

    const userRepo = dataSource.getRepository(Users);

    // 3. 查詢是否已有使用者（以 account 存 email）
    let user = await userRepo.findOneBy({ account: email });

    // 4. 若無則建立
    if (!user) {
      user = userRepo.create({
        id: uuidv4(),
        username: name,
        account: email,
        avatar_url: picture,
        hashed_password: "GOOGLE_LOGIN", // 或空字串
        role_id: 1,
        status_id: 1
      });
      await userRepo.save(user);
    }

    // 5. 發送 JWT token
    const token = jwt.sign({ id: user.id, account: user.account }, JWT_SECRET, { expiresIn: "7d" });

    // 6. 導回前端並附帶 token
    res.redirect(`${FRONTEND_URL}/login-success?token=${token}`);
  } catch (err) {
    console.error("Google OAuth Error:", {
      message: err.message,
      stack: err.stack,
      response: err.response?.data
    });
    res.status(500).send("Google Login Failed");
  }
}

module.exports = { googleCallback };
