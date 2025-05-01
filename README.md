# 💖 Lovia 募資平台

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
- Docker 與 Docker Compose (資料庫服務)

## 🚀 安裝與啟動

1. **安裝依賴**
    ```bash
    npm install
    ```

2. **啟動 Docker 服務（資料庫等）**
    ```bash
    npm run start
    ```
    📌 此指令將使用 docker-compose 啟動所需服務（如 PostgreSQL）。

3. **啟動本地開發伺服器**
    ```bash
    npm run dev
    ```
    預設伺服器會運行在 [http://localhost:3000](http://localhost:3000)。



## 📁 專案結構
```bash
.
├── src/
│   ├── entities/       # TypeORM Entity 定義（資料表）
│   ├── controllers/    # 路由控制器
│   ├── routes/         # API 路由設定
│   └── app.js          # 應用程式入口
├── docker-compose.yml  # Docker 設定檔
├── package.json        # NPM 設定與指令
└── README.md           # 專案說明文件
```
---

## 🛠️ 常用指令一覽

| 指令               | 說明                |
|--------------------|---------------------|
| `npm install`      | 安裝所有依賴套件     |
| `npm run start`    | 啟動 Docker 容器服務 |
| `npm run dev`      | 啟動本地開發伺服器（監聽檔案變更） |

📌 **注意事項**
- Docker 必須先啟動成功，確保資料庫正常連線後再啟動應用伺服器。
- 預設資料表（Entities）為開發階段自動同步 (`synchronize: true`)，正式上線請改為手動 migration。
- `.env` 環境變數需正確設置，包含資料庫連線資訊等。

## 📮 聯絡方式
若有任何建議或問題，歡迎透過 Issue 區提交，或聯繫開發團隊。

---
