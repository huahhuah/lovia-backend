require("dotenv").config();
const crypto = require("crypto");

const HASH_KEY = process.env.HASH_KEY;
const HASH_IV = process.env.HASH_IV;

function decryptTradeInfo(encrypted) {
  const decipher = crypto.createDecipheriv("aes-256-cbc", HASH_KEY, HASH_IV);
  decipher.setAutoPadding(true);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function createTradeSha(tradeInfo) {
  const raw = `HashKey=${HASH_KEY}&TradeInfo=${tradeInfo}&HashIV=${HASH_IV}`;
  const sha = crypto.createHash("sha256").update(raw).digest("hex").toUpperCase();
  return { sha, raw };
}

// 🔍 在這裡貼上你想驗證的加密資料
const tradeInfo =
  "6c15e5bed28afe6b4e30c5fbbc6ef6009e9d540d3c967a4b34bef0d7078e17fd5672111b081c91ae9823aba2c55138ffe62f3ff763098757310d06d4041f8ddfbca04d18c3ccc70f1c83596a7d639cc58fa7ff02f45da858abccf65fe5ba69f4fa409b4da3ad8440848aa0aaca06c84c2a61edafe2c9a4e25edd16cb2a035b3fd12f59960acdfe8806fb4384a9bde3c96dc56d9cdcdfbc7915e2569001139e0c61f6f23724a9be05feda09d5fa862f869b51e85a8a23b33c8bdeb69a2b02ab399882535dc3df2b575c93caa9f9eef545973177a9be409ab0373abcee356b25b691254d29ef0e206cfe9285dc5479137632df8dc6c0a527d719b03153d74d008e86eec6b2402ac8012b2fa020a84cd140c7784fa2e96358de78e5a865ac8dbac39b0ee7b22a66e0688d7cea6196b12e35e51105479d362451ff01b0559216c9eddc3e44bfb494ff2ececf2e5ce1900827e449b4c5622ce3fa787cac084a678fb58e398abcf2ebe230bb782f9fc0240fe3ea54a70dd4fe090b75b7d9e2b4abae708013ed04ba295d6e65b00577cf916ec53424aa5ca447920c8ec534ba4d2d1e546b5515a27c297aa01c2e6b7b967e37cebc679e8c89cc1a12f24819b417bf60bf06f465a1edf9b004195ea0c0f976bd11892c219b68b88dc9c3829a488095f622ed9b9a7a31f9b8d042bd07064b24ff7c";
const tradeSha = "E67CCA0DD3C5BCBC18144044562981D5393CE428E331358697BFECC7DC5CA66B";

try {
  console.log("✅ 解密內容：");
  const decrypted = decryptTradeInfo(tradeInfo);
  console.log(decrypted);

  const { sha, raw } = createTradeSha(tradeInfo);

  console.log("\n🔁 SHA 組合字串：");
  console.log(raw);

  console.log("\n🧮 計算出來的 SHA：", sha);
  console.log("📨 送出的 TradeSha：", tradeSha);

  if (sha === tradeSha) {
    console.log("\n✅ 驗證成功！SHA 一致");
  } else {
    console.error("\n❌ 驗證失敗！SHA 不一致");
  }
} catch (err) {
  console.error("🚨 錯誤：", err.message);
}
