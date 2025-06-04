const crypto = require("crypto");

function generateLinePaySignature(uri, body, nonce, channelSecret) {
  if (!channelSecret || typeof channelSecret !== "string" || channelSecret.trim() === "") {
    console.error("[ channelSecret 錯誤] =", {
      value: channelSecret,
      type: typeof channelSecret,
      isString: typeof channelSecret === "string",
      isEmpty: channelSecret?.trim?.() === ""
    });
    throw new Error("[AuthV2] secret is required and must be a string.");
  }

  const jsonBody = JSON.stringify(body);
  const message = `${channelSecret}${uri}${jsonBody}${nonce}`;

  return crypto.createHmac("sha256", channelSecret).update(message).digest("base64");
}

module.exports = { generateLinePaySignature };
