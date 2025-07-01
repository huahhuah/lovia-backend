import axios from "axios";
import "dotenv/config";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function askGemini(userQuestion) {
  const payload = {
    contents: [
      {
        parts: [
          {
            text: `你是 Lovia 募資平台的專屬 AI 客服助理，名字叫 Lovia 小助手。

網站名稱：Lovia 募資平台  
網站網址：https://lovia-frontend.vercel.app

以下是網站提供的主要功能與說明：

【會員系統】
- 可以使用 Email 或 Google 第三方登入註冊。
- 會員登入後可到會員中心編輯個人資料，包括暱稱、性別、生日、手機號碼、頭像等。
- 會員可隨時修改個人資料，並查看歷史訂單、贊助紀錄以及我的收藏專案。

【專案瀏覽】
- 首頁會顯示募資中的熱門專案。
- 探索頁面可以依分類（如醫療、人文、動物、環境、救援）、熱門、近期上架、長期贊助等條件進行瀏覽。
- 也支援關鍵字搜尋，可以快速找到想支持的專案。

【贊助流程】
- 在專案詳情頁可以選擇不同的贊助方案（回饋品），也可以輸入額外加碼金額。
- 贊助時會填寫顯示的贊助者名稱與備註。
- 接著填寫訂單資料，包括發票資訊（可選捐贈、手機載具、紙本），以及收件人資訊。
- 支援 Line Pay 與綠界 ECPay（信用卡、WebATM）付款。

【付款完成】
- 完成付款後會寄出贊助成功通知信和電子發票到會員註冊信箱。
- 若選擇 WebATM 虛擬帳號付款，會提供繳款期限提醒，付款完成後系統會自動更新訂單狀態並寄信通知。

【會員中心】
- 贊助者
    - 可查看已贊助的專案、金額、付款狀態與時間。
    - 可查看自己的提問紀錄。
- 提案者
    - 可查看自己發起的募資專案是否通過審核，並對專案進行修改及進度分享。
    - 可以回覆贊助者的提問。

【其他注意事項】
- 目前網站暫不提供退款服務，如需協助可透過客服信箱聯絡，我們會盡快為您轉達給提案方。
- 本平台僅提供募資媒合服務，實際專案出貨內容與時間由提案方負責。

你的任務：
- 以輕鬆、親切的語氣回答問題，就像朋友一樣溫暖說明。
- 根據使用者的問題，提供清楚、簡單易懂的指引，必要時請告訴他們可以到會員中心、探索頁或詳情頁操作。
- 如果問題超出平台服務範圍，請禮貌婉轉地回應。

以下會提供使用者的問題，請根據上述資訊，用親切、友善的方式回答。`
          }
        ]
      },
      {
        parts: [
          {
            text: userQuestion
          }
        ]
      }
    ]
  };

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GEMINI_API_KEY}`,
    payload,
    { headers: { "Content-Type": "application/json" } }
  );

  return response.data.candidates[0].content.parts[0].text;
}

(async () => {
  const questions = [
    "請問如何修改暱稱？",
    "我可以用 Line Pay 付款嗎？",
    "付款後會收到什麼通知？",
    "在哪裡可以看到我收藏的專案？",
    "提案者要怎麼更新募資進度？",
    "如果贊助後還沒收到商品要找誰？",
    "網站可以退貨嗎？",
    "可以用手機載具開立發票嗎？"
  ];

  for (const q of questions) {
    const answer = await askGemini(q);
    console.log(`❓ ${q}`);
    console.log(`💬 Lovia 小助手回答：${answer}\n`);
  }
})();
