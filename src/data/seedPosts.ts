import heroMathImg from '../assets/images/hero_math_journal_1795051654965.jpg';
import boardgameCoverImg from '../assets/images/cover_math_boardgame_1795051655094.jpg';
import analyticsCoverImg from '../assets/images/cover_math_analytics_1795051655896.jpg';
import storybookCoverImg from '../assets/images/cover_math_storybook_1795051656136.jpg';
import {JournalPost} from '../types/journal';

export const SEED_POSTS: JournalPost[] = [
  {
    slug: '113-curriculum-inquiry-workshop',
    title: '113 學年度數學素養導向備課：立體幾何與摺紙探究實作',
    summary:
      '彙整本學期領域共同備課焦點，結合正多面體展開圖實作與提問鷹架設計，引導學生從具體操作走向幾何推理。',
    content: `## 一、共備核心目標

本學期數學教學社群以「動手做、看得見的數學推理」為主軸，聚焦中高年級在空間幾何與平面展開圖的迷思概念釐清。透過課堂實際操作木製多面體教具與方格紙展開記錄，協助學生建立圖形旋轉、對應邊與頂點數的空間心像。

> 數學不只是計算程序的記憶，更是觀察規律、提出猜想與驗證關係的思考歷程。

## 二、課堂實施節次規劃

| 教學階段 | 核心任務 | 操作媒材 | 評量觀察重點 |
| :--- | :--- | :--- | :--- |
| 第一節：探索體驗 | 觀察五種柏拉圖立體的表面結構 | 木製正多面體組、紀錄單 | 能正確清點面數、邊數與頂點數 |
| 第二節：展開猜想 | 繪製正方體 11 種展開圖並分類 | 平方公分方格紙、磁力片 | 能辨識旋轉重複圖形並排除無法摺合者 |
| 第三節：歸納推理 | 驗證尤拉公式 V - E + F = 2 | 班級統計彙整表 | 能用口語與算式描述邊、面、頂點的消長 |

## 三、領域教師省思與後續建議

1. 建議低成就學生先從「四連方」與「缺一面盒子」開始，降低同時想像六個面的認知負荷。
2. 各班可將優秀學生的分類筆記拍照上傳至共用雲端資料夾，作為下一次領域會議的公開觀課討論素材。
`,
    category: '領域會議',
    academicYear: '113 學年度',
    publishedAt: '2025-03-14',
    author: 'PesMath 領域備課團隊',
    isFeatured: true,
    status: 'Published',
    coverImageUrl: heroMathImg,
    embedUrl: 'https://drive.google.com/drive/folders/1PesMathDemoFolder',
    embedLabel: '113 學年度立體幾何共備教案與學習單 (Google Drive)',
  },
  {
    slug: '112-math-boardgame-fractions',
    title: 'Fun 肆玩數學：分數概念與因倍數桌遊教學實錄',
    summary:
      '介紹六年級《可惡被因了》與分數拼接桌遊在課堂分組中的實施節奏、規則調整與學生策略觀察。',
    content: `## 教學背景與動機

在國小高年級的「因數與倍數」及「異分母分數加減」單元中，學生常因缺乏反覆推算的動機而停留在機械練習。引入回合制數學桌遊後，學生為了贏得回合必須主動估算公因數與等值分數，顯著提升課堂討論密度。

## 分組運作模式

* **四人一組、兩人一隊**：採合作解題制，減少單打獨鬥的挫折感。
* **策略紀錄單**：每出一次牌需簡短寫下算式理由，將遊戲直覺轉化為正式數學表徵。
* **教師巡堂檢核**：聚焦「最大公因數判斷失誤」的組別進行即時提問引導。

| 遊戲名稱 | 適用年級 | 對應數學單元 | 建議課堂時間 |
| :--- | :--- | :--- | :--- |
| 可惡被因了 | 五、六年級 | 因數與公因數 | 35 分鐘 |
| 分數拼拼樂 | 四、五年級 | 等值分數與擴約分 | 30 分鐘 |
| 魔數大師 | 三至六年級 | 加法推理與機率初探 | 25 分鐘 |
`,
    category: '桌遊與繪本',
    academicYear: '112 學年度',
    publishedAt: '2024-11-22',
    author: '陳怡君 老師',
    isFeatured: true,
    status: 'Published',
    coverImageUrl: boardgameCoverImg,
    embedUrl: 'https://meet.google.com/brc-xdsg-jpm',
    embedLabel: '線上共備討論會議室連結 (Google Meet)',
  },
  {
    slug: '112-assessment-data-analysis',
    title: '111-112 學力檢測結果分析與葉清華教授診斷表格應用',
    summary:
      '結合年度基本學力檢測數據與試題雙向細目表，剖析各年段在「分數除法」與「幾何面積」的失分熱區。',
    content: `## 數據判讀與教學回饋

透過彙整全校各班學力檢測答對率，我們將試題依認知層次分為「概念理解」、「程序執行」與「情境應用」三個維度，並對照葉清華教授所提供的試題診斷表格進行縱向追蹤。

### 關鍵發現摘要

1. **計算程序穩定，但題意轉譯待加強**：純算式題平均通過率達 84%，但加入生活情境文字敘述後下降約 17%。
2. **單位量基準混淆**：分數與小數應用題中，約有 28% 誤答源自學生未能辨識「基準量」與「比較量」。

| 能力指標代號 | 檢測主題 | 全校平均通過率 | 社群共備補強策略 |
| :--- | :--- | :--- | :--- |
| N-5-04 | 異分母分數比較與加減 | 76.4% | 強化分數牆視覺模型對應 |
| S-5-02 | 三角形與四邊形面積 | 71.8% | 使用平行四邊形剪拼操作板 |
| D-6-01 | 統計圖表與平均數判讀 | 82.1% | 結合真實班級生活調查專題 |
`,
    category: '學力檢測',
    academicYear: '112 學年度',
    publishedAt: '2024-05-03',
    author: '數學領域研究小組',
    isFeatured: false,
    status: 'Published',
    coverImageUrl: analyticsCoverImg,
    embedUrl: 'https://docs.google.com/spreadsheets/d/demo-analytics',
    embedLabel: '學力檢測各題通過率統計試算表 (Google Sheets)',
  },
  {
    slug: '111-picturebook-geometry-grade1',
    title: '低年級繪本融入數學：《小小消防員》平面圖形與空間方位',
    summary:
      '以一年級南一第九單元為核心，透過繪本故事情境與七巧板拼組活動，建立孩子對基本幾何形狀的語言描述。',
    content: `## 繪本共讀與數學提問設計

低年級學生對於三角形、正方形、長方形與圓形的認識，往往依賴視覺整體印象，容易受「圖形方向旋轉」影響而誤判（例如頂點朝下的正方形常被誤認為菱形）。

### 課堂引導三步驟

* **步驟一：故事導入** — 共讀《小小消防員》繪本，請學生尋找插畫中藏著哪些幾何圖形。
* **步驟二：七巧板任務** — 使用兩塊或三塊七巧板拼出指定的消防車與雲梯造型，並口頭分享「用了幾個邊、幾個角」。
* **步驟三：生活尋寶** — 記錄教室裡可看見的長方形與圓形物品，完成圖文紀錄卡。
`,
    category: '趣味數學',
    academicYear: '111 學年度',
    publishedAt: '2023-04-28',
    author: '林佳穎 老師',
    isFeatured: false,
    status: 'Published',
    coverImageUrl: storybookCoverImg,
  },
  {
    slug: '111-community-midterm-report',
    title: '111 學年度第一學期 數學教學社群期中成果報告',
    summary:
      '完整記錄 9 月至 12 月共四場次領域備課會議紀要、公開授課觀議課紀錄與跨領域課程地圖建置進度。',
    content: `## 社群運作總覽

本學期共召開 4 次全領域共備會議與 2 場公開授課議課，持續推動「探索・樂章・閱讀・科學專題」跨領域校訂課程之數學能力指標對齊。

### 會議時間與主題一覽

* **09/28 領域會議**：年度計畫定錨與分年級教學資源盤點。
* **10/26 領域會議**：校訂課程地圖分享與六年級桌遊實作研討。
* **11/23 領域會議**：中年級迷思概念診斷與線上教學工具交流。
* **12/28 領域會議**：期中成果彙整與期末學力檢核規劃。

點擊下方嵌入資源即可開啟完整核章版 PDF 與簡報檔案。
`,
    category: '成果報告',
    academicYear: '111 學年度',
    publishedAt: '2023-01-12',
    author: 'PesMath 領召彙整',
    isFeatured: false,
    status: 'Published',
    embedUrl: 'https://drive.google.com/file/d/1DemoMidtermReport/preview',
    embedLabel: '111 學年度期中成果報告完整簡報與核章文件',
  },
  {
    slug: '110-community-annual-plan',
    title: '110 學年度數學領域教學社群設置計畫與評鑑問卷',
    summary:
      '年度社群申請計畫書、入校陪伴教師協作架構，以及學期末教師教學反思與學生學習回饋問卷彙整。',
    content: `## 年度社群願景

我們期許透過常態性的專業對話與課室實踐，累積校本數學趣味教材庫，讓每一位夥伴教師都能在社群支持下嘗試多元評量與差異化教學。

### 實施項目

1. **公開授課與議課**：每學期每位教師至少進行一次單元共備與開放觀課。
2. **數學閱讀書目推薦**：定期評選適合各年段的數學普及讀物，推薦圖書館採購充實館藏。
3. **數位閱卷與即時診斷**：導入 ZipGrade 與線上表單進行單元前測，即時掌握全班先備知識落差。
`,
    category: '社群計畫',
    academicYear: '110 學年度',
    publishedAt: '2021-10-27',
    author: '數學領域召集人',
    isFeatured: false,
    status: 'Published',
    embedUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfDemoForm/viewform',
    embedLabel: '社群課程回饋與成效評鑑問卷 (Google Forms)',
  },
  {
    slug: '109-library-math-books',
    title: '109 學年度推薦圖書館採購數學普及閱讀書單（共 24 冊）',
    summary:
      '依低、中、高年級閱讀程度分級整理 24 本優質數學繪本、漫畫與探索叢書，供教師搭配單元延伸閱讀。',
    content: `## 圖書館新書採購建議清單

為了讓數學學習走出習作與測驗卷，社群夥伴共同試讀並篩選了 24 本兼顧趣味性與數學結構的優良讀物。

### 套書精選推薦

* **《數學冒險玩》1~4 冊**（遠流出版）：適合三至六年級，透過冒險故事帶入數列、幾何與邏輯推理。
* **《神奇酷數學》系列**（小天下出版）：適合四、五年級，以幽默插畫解析分數、比例與測量歷史。
* **《明日數學王》1~10 冊**（三采文化）：全學段適用，以競賽漫畫情境呈現生活數學解題。

### 單本主題繪本（低中年級）

* 《數字在哪裡？》、《誰是幾何大師》、《蛋糕分一分》等 6 冊，已同步建置於學校圖書館數學專區。
`,
    category: '教學資源',
    academicYear: '109 學年度',
    publishedAt: '2020-03-11',
    author: '閱讀與數學跨領域小組',
    isFeatured: false,
    status: 'Published',
  },
  {
    slug: '108-zipgrade-diagnostic-guide',
    title: '108 學年度分享：ZipGrade 數位閱卷系統在單元診斷的應用',
    summary:
      '實作手機快速掃描讀卡與題目選項分析功能，協助教師於課後五分鐘內掌握全班迷思選項分布。',
    content: `## 為什麼導入快速閱卷分析？

傳統紙本改卷往往只能得出總分，卻難以在隔天上課前統計出「哪一個錯誤選項最多學生選」。透過標準化答案卡與即時掃描，教師可以直接檢視每一題的誘答力與作答分布，精準安排補救教學焦點。

### 實務操作提醒

1. 建議選擇 20 題版面答案卡，字體較大且低中年級不易劃錯格。
2. 考前務必指導學生填塗「座號欄」，系統即可自動對應學生成績曲線。
`,
    category: '教學資源',
    academicYear: '108 學年度',
    publishedAt: '2019-06-26',
    author: '資訊融入數學小組',
    isFeatured: false,
    status: 'Published',
  },
];

export const CATEGORY_OPTIONS = [
  '領域會議',
  '趣味數學',
  '桌遊與繪本',
  '學力檢測',
  '教學資源',
  '成果報告',
  '社群計畫',
];

export const ACADEMIC_YEAR_OPTIONS = [
  '113 學年度',
  '112 學年度',
  '111 學年度',
  '110 學年度',
  '109 學年度',
  '108 學年度',
];
