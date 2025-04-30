const jwt = require("jsonwebtoken");
const config = require("../config/index");

const jwtSecret = config.get("secret").jwtSecret;

module.exports = (payload, options = {}) =>
  new Promise((resolve, reject) => {
    jwt.sign(payload, jwtSecret, options, (err, token) => {
      if (err) {
        reject(err);
      } else {
        resolve(token);
      }
    });
  });
