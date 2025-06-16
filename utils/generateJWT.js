const jwt = require("jsonwebtoken");
const config = require("../config");

const jwtSecret = config.get("secret").jwtSecret;

function generateJWT(payload, options = {}) {
  return jwt.sign(payload, jwtSecret, options);
}

module.exports = generateJWT;
