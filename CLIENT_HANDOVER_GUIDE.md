# PesMath 期刊系統 | 客戶自主交付與上線操作手冊

本手冊專門為準備在 **AI Studio** 承接此專案、連結自己的 **Google Sheet** 並部署至自己 **GitHub Pages** 的客戶與管理教師撰寫。請依序參照下方檢查清單逐步執行即可順利上線。

---

## 📋 上線執行檢查清單 (Deployment Checklist)

- [ ] **步驟 1：建立並設定 Google Sheet 資料庫**
- [ ] **步驟 2：在 AI Studio 綁定試算表（一鍵寫入 site-config.json）**
- [ ] **步驟 3（選用）：匯入舊 Blogger / RSS 歷史文章**
- [ ] **步驟 4：建立 GitHub 倉庫並完成 AI Studio 授權推送**
- [ ] **步驟 5：GitHub Pages 設定（選擇 GitHub Actions 來源）**
- [ ] **步驟 6：Firebase Authentication 授權網域設定（允許 Google 登入）**

---

## 詳細執行步驟說明

### 步驟 1：建立並設定 Google Sheet 資料庫

1. **準備 Google Sheet 試算表**：
   - 方式 A（推薦一鍵建立）：在 AI Studio 登入後，打開「管理後台」→ 點擊**「建立並初始化 Google Sheet 資料庫」**，系統會直接在您的 Google 雲端硬碟建立包含標準欄位的專屬試算表。
   - 方式 B（自訂現有表格）：在 Google 試算表建立一個名為 `Posts` 的分頁，並將第 1 列依序設定為以下欄位：
     ```text
     ID | Title | Summary | Content | Category | AcademicYear | PublishedAt | Author | IsFeatured | Status | CoverImageUrl | EmbedUrl | EmbedLabel
     ```

2. **⭐ 極度重要：設定試算表共用權限**：
   - 開啟該 Google Sheet，點選右上角「**共用 (Share)**」。
   - 在「一般存取權」中：
     - 將「已限制」切換為 👉 **「知道連結的任何人」**。
     - 角色權限設定為 👉 **「檢視者 (Viewer)」**。
   - 💡 *為什麼這樣設定？*
     - 訪客不需要任何 Google 登入，即可經由公開 API 瞬間載入所有期刊。
     - 訪客只能「檢視」，無法竄改任何文章資料；只有您授權為「編輯者」的教師 Google 帳號才能登入後台進行新增、修改或刪除。
   - 複製試算表網址中的 **Spreadsheet ID**（例如 `https://docs.google.com/spreadsheets/d/1TYrCzrvZgxwd9nxygksgpUOSJVRb1L3aXCxtDIo4_4E/edit`，其中的 `1TYrCzrvZgxwd9nxygksgpUOSJVRb1L3aXCxtDIo4_4E` 即為 ID）。

---

### 步驟 2：在 AI Studio 綁定試算表（一鍵更新 site-config.json）

1. 在 AI Studio 預覽畫面右上角點擊 **「教師登入」**。
2. 登入後頂部會出現 **「管理後台」** 按鈕，點擊開啟側邊選單。
3. 進入 **「Google Sheets 連線」** 分頁：
   - 在輸入框貼上您在步驟 1 取得的試算表 ID。
   - 分頁名稱輸入 `Posts`。
   - 點擊「**API 讀寫連線**」，確認文章清單正常載入。
4. 滾動至下方的 **「03. 全站預設資料庫設定（Git 部署一氣呵成）」** 區塊：
   - 點擊 **「將目前連線試算表設為全站預設（更新 site-config.json）」** 按鈕。
   - 系統會自動將您的試算表 ID 寫入專案根目錄的 `site-config.json` 檔案。
   - 💡 *無須動手翻找程式碼改 ID，也不必去 GitHub 後台設環境變數，直接跟著 Git 程式碼一併發布！*

---

### 步驟 3（選用）：匯入舊 Blogger / RSS 歷史文章

若學校或教學社群過去有使用 Google Blogger（Blogspot）：
1. 在管理後台切換至 **「RSS / Blogger 匯入」** 分頁。
2. 貼上您的部落格 Feed 網址，例如：
   ```text
   https://<您的部落格名稱>.blogspot.com/feeds/posts/default?max-results=500
   ```
3. 點擊 **「抓取 RSS / Blogger 文章」**。
   - 系統已內建跨來源 JSONP 解析器，在瀏覽器端即可讀取，無 CORS 錯誤。
   - 自動提取每篇文章的標題、學年度、分類標籤、內文首圖與雲端附件連結。
4. 勾選欲匯入的文章，點擊 **「批次寫入 Google Sheet」**，文章將自動寫入試算表中！

---

### 步驟 4：建立 GitHub 倉庫並完成 AI Studio 授權推送

1. 登入您的 GitHub 帳號，新建一個公開倉庫（Repository），例如取名為 `PesMeth`。
2. 在 AI Studio 介面上點擊 **Push to GitHub** 連接至您的倉庫。
3. **🚨 常見坑點 1：GitHub 提示工作流權限不足 (Workflow Permissions)**
   - **錯誤提示**：`Failed to push commit to GitHub, Insufficient permissions to push workflow files. Please re-authorize the AI Studio GitHub App to grant workflows permission.`
   - **原因**：GitHub 為了安全，要求外部應用程式必須獲得明確授權才能推送 `.github/workflows/` 下的自動化工作流檔案。
   - **解決步驟**：
     1. 前往 GitHub 網頁版，點右上角個人頭像 → **Settings**。
     2. 左側選單選擇 **Applications** → 點選 **Authorized GitHub Apps**。
     3. 找到 **Google AI Studio**，點擊 **Review request** 或更新權限按鈕。
     4. 勾選同意授權包含 **Workflows: Read and write** 權限，點擊綠色確認儲存。
     5. 回到 AI Studio 重新點擊 **Try again** 或 **Push to GitHub**，即可順利推上 GitHub！

---

### 步驟 5：GitHub Pages 設定（選擇 GitHub Actions 來源）

1. 前往您的 GitHub 倉庫首頁（`https://github.com/<您的帳號>/PesMeth`）。
2. 進入上方選單的 **「Settings」** → 左側選單點選 **「Pages」**。
3. 找到 **「Build and deployment」** 區塊：
   - 找到 **Source** 下拉選單：
   - 👉 **請務必選擇「GitHub Actions」**（⚠️ 切勿選 Deploy from a branch！）。
4. 切換到頂部的 **「Actions」** 分頁：
   - 會看到自動觸發的工作流 `Deploy PesMath Journal to GitHub Pages`。
   - 專案已配置 Node 24 與 `--legacy-peer-deps`，建置約需 1～2 分鐘。
   - 出現綠色勾勾（Success）代表靜態網站建置成功！
5. 回到 `Settings` → `Pages` 即可看到您的上線公開網址：
   ```text
   https://<您的帳號>.github.io/PesMeth/
   ```

---

### 步驟 6：Firebase Authentication 授權網域設定（允許 Google 登入）

當訪客閱讀時完全不需要登入；但若管理教師要在上線網站點擊「教師登入」進行發布，必須將 GitHub Pages 網域登記至 Firebase 白名單：

1. 前往 [Firebase Console](https://console.firebase.google.com/) 並開啟您的專案。
2. **🚨 常見坑點 2：在「專案設定」找不到授權網域**
   - 請**不要**進右上角齒輪的「專案設定」。
   - 正確路徑：
     1. 點擊左側主功能表中的 **「Authentication」**（或在「Build（建構）」展開項下的 Authentication）。
     2. 在 Authentication 頁面上方點選 **「Settings（設定）」** 分頁。
     3. 展開子項目 **「Authorized domains（已獲授權的網域）」**。
3. 點擊 **「Add domain（新增網域）」**：
   - 填寫您的 GitHub Pages 網域：
     ```text
     <您的帳號>.github.io
     ```
     （例如 `wattgit.github.io`；⚠️ 請勿填寫 `https://`，也請勿填寫後方的子目錄 `/PesMeth/`）。
   - 若未來有使用學校自訂網域（如 `math.school.edu.tw`），也請一併加進去。
4. 點擊儲存。現在打開您的 GitHub Pages 網址，點擊右上角「教師登入」即可成功登入後台！

---

- **RichFormat 富文本編輯器**：支援二級/三級標題、粗斜體、程式碼、表格、清單與引用區塊，可切換「純編輯」、「雙欄即時對照」與「全螢幕專注模式」。
- **圖檔自動上傳 Google Drive**：在編輯器中點擊「插入圖檔」或封面區「上傳封面至 Drive」，可直接選取電腦中的照片，系統自動上傳至您的 Google 雲端硬碟並設定公開檢視，即時嵌入文章或設為封面。
- **雲端物件內嵌 (Embeds)**：可直接內嵌 Google Drive PDF/文件、Google Forms 問卷、Google Meet 視訊會議與 YouTube 教學影片。
- **快速置頂**：想將某篇文章設為置頂焦點？直接在 Google Sheet 的 `IsFeatured` 欄位填寫 `TRUE` 即可。
- **草稿暫存**：文章還在討論階段？將 `Status` 設為 `Draft`，前台訪客就看不到，只有登入教師能在後台預覽。
- **免重複部署**：任何在 Google Sheet 中的修改或新增，都會在讀者重新整理網頁時「即時生效」，不需要重新 Push 或重新建置 GitHub 網站。
