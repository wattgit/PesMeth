# PesMath 數學教學社群 | 期刊與知識專欄系統 (Client & Deployment Guide)

一套以 **純靜態 GitHub Pages 前端** 搭配 **Google Sheets 即時無伺服器資料庫** 的教學期刊與知識庫系統。提供教師團隊流暢的 Markdown 撰稿、Google Drive/Meet/Forms 資源嵌入、Blogger 舊站文章一鍵匯入，並支援一般訪客免登入即時讀取最新期刊。

---

## 快速導覽目錄
1. [系統核心架構與運作邏輯](#1-系統核心架構與運作邏輯)
2. [客戶交付與自主上線 6 大步驟（SOP）](#2-客戶交付與自主上線-6-大步驟sop)
   - [步驟 1：建立或設定 Google Sheet 資料庫](#步驟-1建立或設定-google-sheet-資料庫)
   - [步驟 2：在 AI Studio 綁定試算表（一鍵更新 site-config.json）](#步驟-2在-ai-studio-綁定試算表一鍵更新-site-configjson)
   - [步驟 3：舊版 Blogger / RSS 文章批次匯入（選用）](#步驟-3舊版-blogger--rss-文章批次匯入選用)
   - [步驟 4：推送程式碼至 GitHub 倉庫（避開權限坑點）](#步驟-4推送程式碼至-github-倉庫避開權限坑點)
   - [步驟 5：啟用 GitHub Pages 自動部署工作流](#步驟-5啟用-github-pages-自動部署工作流)
   - [步驟 6：設定 Firebase 授權網域（關鍵登入步驟）](#步驟-6設定-firebase-授權網域關鍵登入步驟)
3. [常見問題與經驗避坑指引（FAQ）](#3-常見問題與經驗避坑指引faq)
4. [日常文章發布與維護指南](#4-日常文章發布與維護指南)

---

## 1. 系統核心架構與運作邏輯

```text
┌────────────────────────────────────────────────────────┐
│               GitHub Pages (純靜態託管)                 │
│                                                        │
│  [訪客/學生] ─────── 公開唯讀查詢 (GViz API) ───────┐  │
│                     (無需登入、即時載入)            │  │
│                                                     │  │
│  [教師/管理員] ─── Sign in with Google (OAuth) ──┐  │  │
│                     (需為試算表之編輯者)         │  │  │
└──────────────────────────────────────────────────┼──┼──┘
                                                   │  │
                                                   ▼  ▼
                             ┌───────────────────────────────┐
                             │    Google Sheets 雲端資料庫    │
                             │   (試算表即後端，欄位清楚直觀)   │
                             └───────────────────────────────┘
```

- **全站預設資料庫來源**：專案根目錄的 `site-config.json`，受 Git 版本控制。部署時 GitHub Actions 自動將其打包至靜態檔案，客戶與訪客無需額外輸入參數。
- **公開訪客讀取（免伺服器）**：透過 Google Visualization API (GViz) 讀取已設定為「知道連結任何人均可檢視」的試算表，零主機費、零資料庫維護成本。
- **管理員即時讀寫（安全鑑權）**：透過 Firebase Auth 完成 Google 帳號授權，以 Google Sheets API v4 直接於瀏覽器端新增、修改或刪除資料列，只有擁有該 Google Sheet 編輯權限的使用者才能異動資料。

---

## 2. 客戶交付與自主上線 6 大步驟（SOP）

### 步驟 1：建立或設定 Google Sheet 資料庫

1. **建立試算表**：
   - 方式 A（一鍵建立）：在 AI Studio 登入 Google 帳號後，進入「管理後台」→ 點擊**「建立並初始化 Google Sheet 資料庫」**，系統會自動在您的 Google Drive 建立標準欄位表格並寫入示範資料。
   - 方式 B（手動建立）：在 Google 雲端硬碟建立空白試算表，分頁名稱命名為 `Posts`，並於第一列（Row 1）依序建立下列 13 個英文字段欄位名稱：
     ```text
     ID | Title | Summary | Content | Category | AcademicYear | PublishedAt | Author | IsFeatured | Status | CoverImageUrl | EmbedUrl | EmbedLabel
     ```

2. **設定試算表共用權限（最重要！）**：
   - 點擊試算表右上角**「共用 (Share)」**。
   - 在「一般存取權」區塊，將存取權由「已限制」切換為：
     👉 **「知道連結的任何人」** + 權限選擇 **「檢視者 (Viewer)」**。
   - ⚠️ **為什麼要這樣設？**：若設為「已限制」，GitHub Pages 上的大眾訪客將無法讀取文章。設為「檢視者」可確保訪客即時閱讀，但無法竄改；只有您明確加入的 Google 帳號才能進行編輯。
   - 複製瀏覽器網址列中的試算表 ID（位於 `/d/` 與 `/edit` 之間的那串字元，例如 `1TYrCzrvZgxwd9nxygksgpUOSJVRb1L3aXCxtDIo4_4E`）。

---

### 步驟 2：在 AI Studio 綁定試算表（一鍵更新 site-config.json）

1. 在 AI Studio 開啟專案預覽視窗。
2. 點擊右上角**「教師登入」**，以您的 Google 帳號登入。
3. 登入後頂部會出現**「管理後台」**按鈕，點擊開啟側邊抽屜面板。
4. 切換至**「Google Sheets 連線」**分頁：
   - 在「Google Sheet 網址或 ID」輸入框貼上您的試算表 ID。
   - 工作表分頁填入 `Posts`。
   - 點擊**「API 讀寫連線」**（已登入狀態）或**「公開唯讀連線」**，確認文章能正常同步載入。
5. 滑動至下方 **「03. 全站預設資料庫設定（Git 部署一氣呵成）」** 區塊：
   - 點擊 **「將目前連線試算表設為全站預設（更新 site-config.json）」**。
   - 系統會自動將您的試算表 ID 寫入專案根目錄的 `site-config.json`。
   - 💡 **好處**：完全不用去程式碼搜尋修改，也不用至 GitHub 後台設定複雜的環境變數！

---

### 步驟 3：舊版 Blogger / RSS 文章批次匯入（選用）

若您有舊的 Google Blogger 或 RSS 文章欲搬遷至本系統：
1. 進入「管理後台」→ 點擊**「RSS / Blogger 匯入」**分頁。
2. 在網址列輸入 Blogger Feed 網址，例如：
   ```text
   https://ximen-math.blogspot.com/feeds/posts/default?max-results=500
   ```
3. 點擊**「抓取 RSS / Blogger 文章」**：
   - 系統採用跨來源 JSONP 技術，無 CORS 跨域阻擋問題。
   - 自動提取文章分類標籤、學年度標籤、內文首張特色圖片，以及 Google Drive 附件連結。
4. 勾選欲匯入的文章（可勾選「略過已存在文章」避免重複）。
5. 點擊**「批次寫入 Google Sheet」**，系統會透過 Google Sheets API 將所有文章逐筆自動追加至您的試算表中！

---

### 步驟 4：推送程式碼至 GitHub 倉庫（避開權限坑點）

1. 在您的 GitHub 帳號下建立一個新的公開倉庫（Repository），例如命名為 `PesMeth`。
2. 在 AI Studio 點擊 **Push to GitHub** 連線至您的倉庫。
3. ⚠️ **關鍵避坑點：GitHub App Workflow 權限不足報錯**
   - **現象**：若彈出 `Failed to push commit to GitHub, Insufficient permissions to push workflow files. Please re-authorize the AI Studio GitHub App to grant workflows permission.`
   - **原因**：因為專案包含 `.github/workflows/deploy.yml` 自動部署腳本，GitHub 預設安全規範要求另外授權。
   - **解法**：
     1. 前往 GitHub 個人設定：`Settings` → `Applications` → `Authorized GitHub Apps`。
     2. 找到 `Google AI Studio`，點擊右側的 `Review request` 或設定按鈕。
     3. 勾選同意更新權限（授權包含 Workflows 讀寫），點擊綠色按鈕確認。
     4. 回到 AI Studio 重新點擊 **Try again** 或 **Push to GitHub**，即可順利推送成功！

---

### 步驟 5：啟用 GitHub Pages 自動部署工作流

1. 前往您的 GitHub 倉庫頁面（例如 `https://github.com/<您的帳號>/PesMeth`）。
2. 進入頂部分頁 **「Settings」** → 左側選單點選 **「Pages」**。
3. 在 **「Build and deployment」** 區塊：
   - **Source（來源）**：請務必下拉切換為 **「GitHub Actions」**（千萬不要選 Deploy from a branch！）。
4. 切換至倉庫的 **「Actions」** 分頁：
   - 您會看到名為 `Deploy PesMath Journal to GitHub Pages` 的自動化流程正在執行。
   - 流程中會以 Node 24 執行 `npm install --legacy-peer-deps` 與 `npm run build`。
   - 耗時約 1～2 分鐘，看到綠色勾勾 ✅ 即代表部署完成！
5. 回到 `Settings` → `Pages`，頂端會顯示您的上線網址：
   ```text
   https://<您的帳號>.github.io/PesMeth/
   ```

---

### 步驟 6：設定 Firebase 授權網域（關鍵登入步驟）

為了讓您在 GitHub Pages 上線網站點擊「Sign in with Google」時能夠順利登入，必須將您的網域加入白名單：

1. 前往 [Firebase Console](https://console.firebase.google.com/)。
2. 選擇本專案使用的 Firebase 專案（或您的 Firebase 專案）。
3. ⚠️ **關鍵路徑指引（切勿迷路）**：
   - 不要進「專案設定 (Project Settings)」，那裡沒有網域設定！
   - 請在左側主選單點擊 **「Authentication」**（或在 Build 分頁展開下的 Authentication）。
   - 在上方分頁列點選 **「Settings（設定）」**。
   - 點擊子選單中的 **「Authorized domains（已獲授權的網域）」**。
4. 點擊 **「Add domain（新增網域）」**：
   - 輸入您的 GitHub Pages 網域：
     ```text
     <您的帳號>.github.io
     ```
     （例如 `wattgit.github.io`，注意：只填寫網域名稱，**不要**包含 `https://` 或後面的路徑 `/PesMeth/`）。
   - 若未來有綁定學校自訂網域（例如 `journal.school.edu.tw`），也請一併加進來。
5. 點擊儲存。現在打開您的 GitHub Pages 網站，點擊右上角「教師登入」即可正常登入並管理文章！

---

## 3. 常見問題與經驗避坑指引（FAQ）

| 問題現象 | 原因分析 | 解決辦法 |
| :--- | :--- | :--- |
| **GitHub Pages 訪客打開時顯示「連線錯誤」或「請先設定共用」** | Google Sheet 尚未開啟公開讀取權限。 | 前往試算表右上角「共用」→「一般存取權」改為「知道連結的任何人」+「檢視者」。 |
| **登入 Google 後點擊儲存文章顯示「Request had insufficient authentication scopes」或 403** | 登入的使用者帳號在該 Google Sheet 中沒有「編輯者」權限。 | 由試算表擁有者將該教師之 Google Email 加入試算表共用名單並給予「編輯者」權限。 |
| **在 GitHub Pages 點擊 Sign in with Google 出現 auth/unauthorized-domain 錯誤** | 尚未將 `<帳號>.github.io` 加入 Firebase 授權網域。 | 參考步驟 6，進入 Firebase Console → Authentication → Settings → Authorized domains 加入該網域。 |
| **Push 至 GitHub 時報錯 `Insufficient permissions to push workflow files`** | GitHub 帳號尚未授權 AI Studio 寫入 `.github/workflows` 的權限。 | 參考步驟 4，至 GitHub `Settings` → `Applications` → `Authorized GitHub Apps` 通過權限審核。 |
| **GitHub Actions 建置失敗 `exit code 254` 或找不到 `package.json`** | 倉庫中只有 workflow yml 檔案，專案程式碼尚未完整推送。 | 在 AI Studio 確認所有檔案已儲存，重新執行 Push to GitHub 完整推送程式碼。 |
| **GitHub Actions 建置失敗 `npm error code ERESOLVE`** | Vite 8 與部分插件 peer dependency 嚴格檢查衝突。 | 專案工作流已內建 `--legacy-peer-deps` 與 Node 24 最佳設定，直接推送即可通過。 |

---

## 4. 日常文章發布與維護指南

### 方式一：透過網站後台介面發布（最直觀）
1. 打開 GitHub Pages 網站，點擊右上角**「教師登入」**。
2. 登入成功後，點擊**「管理後台」**。
3. 點選**「文章管理」**分頁：
   - 填寫標題、學年度、分類、摘要。
   - 內文支援標準 Markdown（支援 `## 標題`、`**粗體**`、清單、表格、程式碼等）。
   - 可貼上 Google Drive 資料夾/文件連結、Google Meet 會議代碼或 Google 表單。
4. 狀態選擇 `Published`（公開發布）或 `Draft`（草稿），點擊「寫入 Google Sheet」。
5. 資料直接寫入雲端試算表，前台網頁立刻更新！

### 方式二：直接在 Google 試算表中批次編輯（最快速）
- 試算表本身就是您的資料庫！
- 您可以直接用 Google 試算表 App 或網頁打開該 Sheet：
  - 複製、貼上多篇文章。
  - 直接調整 `IsFeatured`（設為 `TRUE` 即可置頂精選）。
  - 將 `Status` 改為 `Draft` 即可隱藏該篇文章。
- 試算表編輯完畢後，前台訪客重新整理網頁便會即時載入最新內容，**完全不需要重新 Build 或 Deploy 網站**！

---

## 5. 專案重要檔案結構說明

```text
├── site-config.json              # 全站預設試算表設定 (Git 追蹤，修改後推送即生效)
├── .github/workflows/deploy.yml  # GitHub Actions 自動部署至 GitHub Pages 的工作流
├── index.html                    # 網站入口，包含微排版字體 (Fraunces, IBM Plex Mono)
├── metadata.json                 # AI Studio 應用程式元資料
├── src/
│   ├── config/siteConfig.ts      # 讀取 site-config.json 與環境變數之設定模組
│   ├── services/
│   │   ├── googleAuth.ts         # Firebase Auth Google 登入與 Token 記憶體快取
│   │   ├── sheetsDb.ts           # Google Sheets API v4 CRUD 與 GViz 公開讀取引擎
│   │   └── rssImporter.ts        # Blogger / RSS Feed 跨來源 JSONP 批次匯入工具
│   ├── components/
│   │   ├── SheetsCmsDrawer.tsx   # 管理後台抽屜（試算表連線、文章管理、RSS匯入、設定）
│   │   ├── ArticleCard.tsx       # 期刊卡片元件（零藥丸排版、學術專欄感）
│   │   └── ArticleReaderModal.tsx# 文章全文閱讀器（Markdown、雲端附件預覽）
│   └── App.tsx                   # 應用程式主畫面與頂部欄（訪客與管理員雙模式）
```
