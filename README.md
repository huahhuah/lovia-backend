
# 💖 Lovia 公益募資平台

## 📖 專案簡介
Lovia 是一個溫暖情感風格的線上募資平台，支援提案、贊助、專案管理等功能。  
平台同時內建後台管理系統，供管理員監控與維護平台運作。

## 🛠️ 技術棧
- Node.js  
- Express.js  
- PostgreSQL  
- TypeORM  
- Docker / Docker Compose

## ⚙️ 環境需求
- Node.js >= 18.x  
- npm >= 9.x  
- Docker 與 Docker Compose（資料庫服務）

## 🚀 安裝與啟動

1. **安裝依賴**
   ```bash
   npm install
2. **啟動 Docker 服務（資料庫等）**
    ```bash
    npm run start
3. **啟動本地開發伺服器 **
   ```bash
   npm run dev
預設伺服器會運行在 http://localhost:3000。

## 🔐 使用者驗證與登入

- 本平台支援多元會員登入與驗證方式：

- Email + 密碼登入／註冊

- LINE OAuth 登入（自動建立會員資料）

- JWT Token 用於 API 存取與身份驗證

## 💳 金流整合

- Lovia 支援下列金流服務，完成線上付款：

- LINE Pay：快速整合 LINE 支付體驗。

- 綠界 ECPay：支援信用卡與 ATM 虛擬帳號付款。

- 所有付款皆可搭配自動開立電子發票與 Email 通知。

## 📁 專案結構

```text
.
├── .github/            # GitHub 設定與 workflow
├── bin/                # 應用程式啟動腳本
├── config/             # 設定檔（如資料庫設定）
├── controllers/        # 路由控制器
├── cronJobs/           # 排程任務（如定時更新專案狀態）
├── db/                 # 資料庫初始化與連線
├── entities/           # TypeORM Entity 定義（資料表）
├── middlewares/        # 中介軟體（如驗證、錯誤處理）
├── node_modules/       # 套件依賴
├── routes/             # API 路由設定
├── scripts/            # 額外腳本（如資料填充、備份）
├── services/           # 商業邏輯層
├── src/                # 主程式碼根目錄
├── utils/              # 工具函式（如加密、格式化等）
├── docker-compose.yml  # Docker 設定檔
├── package.json        # NPM 設定與指令
└── README.md           # 專案說明文件
```

## 🧪 常用指令一覽

| 指令              | 說明                |
| --------------- | ----------------- |
| `npm install`   | 安裝所有依賴套件          |
| `npm run start` | 啟動 Docker 容器服務    |
| `npm run dev`   | 啟動本地開發伺服器（監聽檔案變更） |

## 📌 注意事項

- Docker 必須先啟動成功，確保資料庫正常連線後再啟動應用伺服器。

- 預設資料表為開發階段自動同步（synchronize: true），正式上線請改為手動 migration。

- .env 環境變數需正確設置（如資料庫連線、JWT 密鑰、LINE Pay 金鑰等）。

## 📮 聯絡方式

- 若有任何建議或問題，歡迎透過 Issue 區提交，或聯繫開發團隊。
