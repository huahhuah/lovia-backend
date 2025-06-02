const dotenv = require("dotenv");

// 只在開發環境下才讀取 .env 檔案
if (process.env.NODE_ENV !== "production") {
  const result = dotenv.config();
  if (result.error) {
    throw result.error;
  }
}

const db = require("./db");
const web = require("./web");
const secret = require("./secret");
const email = require("./email");

const config = {
  db,
  web,
  secret,
  email
};

class ConfigManager {
  /**
   * Retrieves a configuration value based on the provided dot-separated path.
   * Throws an error if the specified configuration path is not found.
   *
   * @param {string} path - Dot-separated string representing the configuration path.
   * @returns {*} - The configuration value corresponding to the given path.
   * @throws Will throw an error if the configuration path is not found.
   */
  static get(path) {
    if (!path || typeof path !== "string") {
      throw new Error(`incorrect path: ${path}`);
    }
    const keys = path.split(".");
    let configValue = config;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(configValue, key)) {
        throw new Error(`config ${path} not found`);
      }
      configValue = configValue[key];
    }
    return configValue;
  }
}

module.exports = ConfigManager;
