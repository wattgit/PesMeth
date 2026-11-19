import React, {useEffect, useState} from 'react';
import {User} from 'firebase/auth';
import {
  Check,
  Copy,
  Database,
  Download,
  Edit3,
  ExternalLink,
  FilePlus2,
  FolderGit2,
  LogOut,
  RefreshCw,
  Rss,
  Sheet,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {ACADEMIC_YEAR_OPTIONS, CATEGORY_OPTIONS} from '../data/seedPosts';
import {
  fetchRssFeedPosts,
  parseRssOrAtomXml,
  RssImportResult,
} from '../services/rssImporter';
import {
  exportPostsAsCsv,
  exportPostsAsJson,
  extractSpreadsheetId,
} from '../services/sheetsDb';
import {
  DataSourceMode,
  JournalPost,
  PostStatus,
  SpreadsheetMeta,
} from '../types/journal';
import {GoogleSignInButton} from './GoogleSignInButton';

export type DrawerTab = 'sheets' | 'editor' | 'rss' | 'architecture';

interface SheetsCmsDrawerProps {
  isOpen: boolean;
  initialTab?: DrawerTab;
  editingPost?: JournalPost | null;
  onClose: () => void;
  // Auth
  user: User | null;
  hasAccessToken: boolean;
  isSigningIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  // Data Source
  dataSourceMode: DataSourceMode;
  sheetMeta: SpreadsheetMeta | null;
  publicSheetId: string;
  isSyncing: boolean;
  syncError: string | null;
  posts: JournalPost[];
  onCreateNewSheet: () => void;
  onConnectSheetApi: (spreadsheetIdOrUrl: string) => void;
  onConnectPublicSheet: (spreadsheetIdOrUrl: string, tabName?: string) => void;
  onSwitchSheetTab: (tabName: string) => void;
  onRefreshSync: () => void;
  onResetToSeed: () => void;
  // CRUD
  onSavePost: (post: JournalPost, isNew: boolean) => void;
  onDeletePost: (post: JournalPost) => void;
  onImportJsonPosts: (posts: JournalPost[]) => void;
  onBatchImportPosts: (posts: JournalPost[]) => void;
}

const EMPTY_FORM: JournalPost = {
  slug: '',
  title: '',
  summary: '',
  content: '',
  category: '領域會議',
  academicYear: '113 學年度',
  publishedAt: new Date().toISOString().slice(0, 10),
  author: 'PesMath 領域教師',
  isFeatured: false,
  status: 'Published',
  coverImageUrl: '',
  embedUrl: '',
  embedLabel: '',
};

const GITHUB_ACTIONS_YML = `name: Deploy PesMath Journal to GitHub Pages
on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
      - run: npm install --legacy-peer-deps
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4`;

export const SheetsCmsDrawer: React.FC<SheetsCmsDrawerProps> = ({
  isOpen,
  initialTab = 'sheets',
  editingPost = null,
  onClose,
  user,
  hasAccessToken,
  isSigningIn,
  onSignIn,
  onSignOut,
  dataSourceMode,
  sheetMeta,
  publicSheetId,
  isSyncing,
  syncError,
  posts,
  onCreateNewSheet,
  onConnectSheetApi,
  onConnectPublicSheet,
  onSwitchSheetTab,
  onRefreshSync,
  onResetToSeed,
  onSavePost,
  onDeletePost,
  onImportJsonPosts,
  onBatchImportPosts,
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>(initialTab);
  const [sheetInput, setSheetInput] = useState('');
  const [publicTabInput, setPublicTabInput] = useState('');
  const [formState, setFormState] = useState<JournalPost>(EMPTY_FORM);
  const [isNewPost, setIsNewPost] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // RSS / Blogger import state
  const [rssUrl, setRssUrl] = useState(
    'https://ximen-math.blogspot.com/feeds/posts/default?max-results=500',
  );
  const [rssXmlFallback, setRssXmlFallback] = useState('');
  const [showXmlFallback, setShowXmlFallback] = useState(false);
  const [isFetchingRss, setIsFetchingRss] = useState(false);
  const [rssError, setRssError] = useState<string | null>(null);
  const [rssResult, setRssResult] = useState<RssImportResult | null>(null);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (editingPost) {
      setFormState({...EMPTY_FORM, ...editingPost});
      setIsNewPost(false);
      setActiveTab('editor');
    }
  }, [editingPost]);

  useEffect(() => {
    const activeId = sheetMeta?.spreadsheetId || publicSheetId;
    if (activeId && !sheetInput) {
      setSheetInput(activeId);
    }
  }, [sheetMeta, publicSheetId]);

  if (!isOpen) return null;

  const activeSpreadsheetId = sheetMeta?.spreadsheetId || publicSheetId;

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard failures silently
    }
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], {type: mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) {
          throw new Error('JSON 檔案必須是文章物件陣列。');
        }
        onImportJsonPosts(parsed as JournalPost[]);
      } catch (err: any) {
        setImportError(err?.message || '無法解析匯入的 JSON 檔案。');
      }
    };
    reader.readAsText(file);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const safeSlug =
      formState.slug.trim() ||
      `post-${Date.now().toString(36)}`;
    onSavePost(
      {
        ...formState,
        slug: safeSlug,
        title: formState.title.trim(),
      },
      isNewPost,
    );
  };

  const shareableGitHubPagesUrl = activeSpreadsheetId
    ? `${window.location.origin}${window.location.pathname}?sheet=${encodeURIComponent(
        activeSpreadsheetId,
      )}`
    : '';

  const existingSlugSet = new Set(posts.map((p) => p.slug));
  const existingTitleSet = new Set(posts.map((p) => p.title.trim()));

  const isDuplicatePost = (p: JournalPost) =>
    existingSlugSet.has(p.slug) || existingTitleSet.has(p.title.trim());

  const applyRssResult = (res: RssImportResult) => {
    setRssResult(res);
    const initialSelected = new Set<string>();
    res.posts.forEach((p) => {
      if (!skipDuplicates || !isDuplicatePost(p)) {
        initialSelected.add(p.slug);
      }
    });
    setSelectedSlugs(initialSelected);
  };

  const handleFetchRss = async () => {
    setIsFetchingRss(true);
    setRssError(null);
    try {
      const res = await fetchRssFeedPosts(rssUrl);
      applyRssResult(res);
    } catch (err: any) {
      setRssError(err?.message || '讀取 RSS Feed 失敗。');
    } finally {
      setIsFetchingRss(false);
    }
  };

  const handleParseXmlFallback = () => {
    setRssError(null);
    try {
      const res = parseRssOrAtomXml(rssXmlFallback);
      applyRssResult(res);
    } catch (err: any) {
      setRssError(err?.message || '解析 XML 內容失敗。');
    }
  };

  const toggleSelectSlug = (slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const rssPostsToImport = rssResult
    ? rssResult.posts.filter(
        (p) =>
          selectedSlugs.has(p.slug) && (!skipDuplicates || !isDuplicatePost(p)),
      )
    : [];

  return (
    <div
      className="fixed inset-0 z-40 overflow-hidden bg-stone-950/50 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cms-drawer-title"
    >
      <div className="w-full max-w-3xl bg-[#FBF9F5] border-l border-stone-200 h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="px-6 py-4 bg-white border-b border-stone-200 flex items-center justify-between gap-4">
          <div>
            <h2
              id="cms-drawer-title"
              className="font-editorial text-xl font-semibold text-stone-950"
            >
              Google Sheets 資料庫與發布中心
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              連結 Google 試算表作為無伺服器後端，或匯出靜態檔案部署至 GitHub Pages
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
            aria-label="關閉管理面板"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Tab Bar */}
        <div className="px-6 py-3 bg-[#F7F4EE] border-b border-stone-200 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('sheets')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'sheets'
                ? 'bg-white text-stone-950 border border-stone-200 shadow-xs'
                : 'text-stone-600 hover:text-stone-950'
            }`}
          >
            <Sheet className="w-3.5 h-3.5" />
            <span>Google Sheets 連線</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'editor'
                ? 'bg-white text-stone-950 border border-stone-200 shadow-xs'
                : 'text-stone-600 hover:text-stone-950'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>文章管理 ({posts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rss')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'rss'
                ? 'bg-white text-stone-950 border border-stone-200 shadow-xs'
                : 'text-stone-600 hover:text-stone-950'
            }`}
          >
            <Rss className="w-3.5 h-3.5" />
            <span>RSS / Blogger 匯入</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'architecture'
                ? 'bg-white text-stone-950 border border-stone-200 shadow-xs'
                : 'text-stone-600 hover:text-stone-950'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>GitHub Pages 與資料庫方案</span>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {syncError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 leading-relaxed">
              <strong className="font-semibold block mb-1">連線或存取錯誤</strong>
              {syncError}
            </div>
          )}

          {activeTab === 'sheets' && (
            <div className="space-y-6">
              {/* Google Account Authentication Section */}
              <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-editorial text-base font-semibold text-stone-900">
                      01. Google 帳號授權（啟用即時新增與編輯）
                    </h3>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      登入後可直接從瀏覽器建立專屬 Google Sheet、讀取私人試算表，並即時新增、修改或刪除期刊文章。
                    </p>
                  </div>
                  {user && hasAccessToken ? (
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-semibold text-stone-900">
                          {user.displayName || '已授權使用者'}
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {user.email}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onSignOut}
                        className="px-3 py-2 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>登出</span>
                      </button>
                    </div>
                  ) : (
                    <div className="shrink-0">
                      <GoogleSignInButton
                        onClick={onSignIn}
                        disabled={isSigningIn}
                        label={isSigningIn ? '登入授權中...' : 'Sign in with Google'}
                      />
                    </div>
                  )}
                </div>

                {user && hasAccessToken && (
                  <div className="pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-stone-600">
                      沒有現成的試算表？可一鍵在您的 Google 雲端硬碟建立標準格式資料庫並寫入示範文章。
                    </div>
                    <button
                      type="button"
                      onClick={onCreateNewSheet}
                      disabled={isSyncing}
                      className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-lg hover:bg-[#172554] disabled:bg-stone-400 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <FilePlus2 className="w-3.5 h-3.5" />
                      <span>建立並初始化 Google Sheet 資料庫</span>
                    </button>
                  </div>
                )}
              </section>

              {/* Connect Existing Sheet (API or Public GViz) */}
              <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <div>
                  <h3 className="font-editorial text-base font-semibold text-stone-900">
                    02. 連結現有 Google Sheet（支援 API 讀寫與公開唯讀）
                  </h3>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    貼上試算表網址或 Spreadsheet ID。若設定為「知道連結的任何人均可檢視」，GitHub Pages 訪客無需登入即可即時載入最新文章。
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="sheet-id-input"
                      className="block text-xs font-medium text-stone-700 mb-1"
                    >
                      Google Sheet 網址或 ID
                    </label>
                    <input
                      id="sheet-id-input"
                      type="text"
                      value={sheetInput}
                      onChange={(e) => setSheetInput(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/... 或試算表 ID"
                      className="w-full px-3.5 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="public-tab-input"
                        className="block text-xs font-medium text-stone-700 mb-1"
                      >
                        工作表分頁名稱（公開唯讀選填，留空讀第一分頁）
                      </label>
                      <input
                        id="public-tab-input"
                        type="text"
                        value={publicTabInput}
                        onChange={(e) => setPublicTabInput(e.target.value)}
                        placeholder="例如：Posts"
                        className="w-full px-3.5 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      {hasAccessToken && (
                        <button
                          type="button"
                          onClick={() =>
                            onConnectSheetApi(extractSpreadsheetId(sheetInput))
                          }
                          disabled={!sheetInput.trim() || isSyncing}
                          className="flex-1 px-3.5 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-lg hover:bg-[#172554] disabled:bg-stone-300 transition-colors whitespace-nowrap shrink-0"
                        >
                          API 讀寫連線
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onConnectPublicSheet(
                            extractSpreadsheetId(sheetInput),
                            publicTabInput.trim() || undefined,
                          )
                        }
                        disabled={!sheetInput.trim() || isSyncing}
                        className="flex-1 px-3.5 py-2 text-xs font-medium text-stone-800 bg-[#F7F4EE] border border-stone-300 rounded-lg hover:bg-stone-200/70 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                      >
                        公開唯讀連線
                      </button>
                    </div>
                  </div>
                </div>

                {/* Active Connection Status & Dynamic Tab Switcher */}
                <div className="pt-4 border-t border-stone-100 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="text-stone-600">
                      目前資料來源：
                      <strong className="text-stone-950 ml-1">
                        {dataSourceMode === 'sheets-api'
                          ? `Google Sheets API (${sheetMeta?.title || activeSpreadsheetId})`
                          : dataSourceMode === 'sheets-public'
                          ? `公開 Google Sheet (${activeSpreadsheetId})`
                          : dataSourceMode === 'local-json'
                          ? '本機匯入 JSON 資料集'
                          : '內建 PesMath 示範資料庫'}
                      </strong>
                    </div>
                    <div className="flex items-center gap-2">
                      {(dataSourceMode === 'sheets-api' ||
                        dataSourceMode === 'sheets-public') && (
                        <button
                          type="button"
                          onClick={onRefreshSync}
                          disabled={isSyncing}
                          className="px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-50 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              isSyncing ? 'animate-spin' : ''
                            }`}
                          />
                          <span>重新同步</span>
                        </button>
                      )}
                      {dataSourceMode !== 'seed' && (
                        <button
                          type="button"
                          onClick={onResetToSeed}
                          className="px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 underline underline-offset-2 whitespace-nowrap shrink-0"
                        >
                          切回示範資料
                        </button>
                      )}
                    </div>
                  </div>

                  {sheetMeta && sheetMeta.tabs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-stone-500">工作表分頁：</span>
                      {sheetMeta.tabs.map((tab) => (
                        <button
                          key={tab.sheetId}
                          type="button"
                          onClick={() => onSwitchSheetTab(tab.title)}
                          className={`px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                            sheetMeta.activeTab === tab.title
                              ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                              : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          {tab.title}
                        </button>
                      ))}
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${sheetMeta.spreadsheetId}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto inline-flex items-center gap-1 text-[#1E3A8A] hover:underline"
                      >
                        <span>開啟 Google Sheet</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {shareableGitHubPagesUrl && (
                    <div className="p-3 bg-[#F7F4EE] border border-stone-200 rounded-lg flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-stone-500">
                          GitHub Pages 公開讀取網址參數（訪客開啟即自動載入此試算表）
                        </div>
                        <div className="text-xs font-mono-tabular text-stone-800 truncate mt-0.5">
                          {shareableGitHubPagesUrl}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(shareableGitHubPagesUrl, 'share')}
                        className="px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-300 rounded-md hover:bg-stone-50 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        {copiedId === 'share' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                            <span>已複製</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>複製網址</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="space-y-6">
              {dataSourceMode !== 'sheets-api' && (
                <div className="p-4 bg-[#F7F4EE] border border-stone-200 rounded-xl text-xs text-stone-700 leading-relaxed flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    目前尚未以 Google Sheets API 讀寫模式連線，文章編輯結果將僅更新於目前瀏覽器工作階段（可匯出 JSON 備份）。
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('sheets')}
                    className="px-3 py-1.5 text-xs font-medium text-[#1E3A8A] bg-white border border-[#1E3A8A]/30 rounded-lg hover:bg-[#1E3A8A]/5 whitespace-nowrap shrink-0"
                  >
                    前往連線 Google Sheets
                  </button>
                </div>
              )}

              {/* Article Form */}
              <form
                onSubmit={handleSubmitForm}
                className="bg-white border border-stone-200 rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between gap-4 border-b border-stone-100 pb-3">
                  <h3 className="font-editorial text-base font-semibold text-stone-900">
                    {isNewPost ? '發布新期刊文章' : `編輯文章：${formState.title}`}
                  </h3>
                  {!isNewPost && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormState(EMPTY_FORM);
                        setIsNewPost(true);
                      }}
                      className="text-xs font-medium text-[#1E3A8A] hover:underline whitespace-nowrap shrink-0"
                    >
                      + 切換為新增文章
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      文章標題 *
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.title}
                      onChange={(e) =>
                        setFormState({...formState, title: e.target.value})
                      }
                      placeholder="例如：1130320 領域共備會議紀錄與教案分享"
                      className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Slug 代碼（留空自動產生）
                    </label>
                    <input
                      type="text"
                      value={formState.slug}
                      onChange={(e) =>
                        setFormState({...formState, slug: e.target.value})
                      }
                      placeholder="1130320-meeting"
                      className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      發布日期
                    </label>
                    <input
                      type="date"
                      value={formState.publishedAt}
                      onChange={(e) =>
                        setFormState({...formState, publishedAt: e.target.value})
                      }
                      className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      學年度
                    </label>
                    <input
                      type="text"
                      list="academic-year-list"
                      value={formState.academicYear}
                      onChange={(e) =>
                        setFormState({...formState, academicYear: e.target.value})
                      }
                      className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                    <datalist id="academic-year-list">
                      {ACADEMIC_YEAR_OPTIONS.map((yr) => (
                        <option key={yr} value={yr} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      分類
                    </label>
                    <input
                      type="text"
                      list="category-list"
                      value={formState.category}
                      onChange={(e) =>
                        setFormState({...formState, category: e.target.value})
                      }
                      className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                    <datalist id="category-list">
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      撰稿者 / 教師社群
                    </label>
                    <input
                      type="text"
                      value={formState.author}
                      onChange={(e) =>
                        setFormState({...formState, author: e.target.value})
                      }
                      className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      發布狀態
                    </label>
                    <select
                      value={formState.status}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          status: e.target.value as PostStatus,
                        })
                      }
                      className="w-full px-3.5 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    >
                      <option value="Published">Published（公開發布）</option>
                      <option value="Draft">Draft（草稿預覽）</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      文章摘要
                    </label>
                    <input
                      type="text"
                      value={formState.summary}
                      onChange={(e) =>
                        setFormState({...formState, summary: e.target.value})
                      }
                      placeholder="1–2 句簡短說明本篇教學內容或會議重點"
                      className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      文章內文（支援 Markdown 語法與表格）
                    </label>
                    <textarea
                      rows={6}
                      value={formState.content}
                      onChange={(e) =>
                        setFormState({...formState, content: e.target.value})
                      }
                      placeholder="## 會議重點&#10;&#10;1. 課堂實作觀察..."
                      className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      嵌入資源連結（Google Drive / Meet / Forms）
                    </label>
                    <input
                      type="url"
                      value={formState.embedUrl || ''}
                      onChange={(e) =>
                        setFormState({...formState, embedUrl: e.target.value})
                      }
                      placeholder="https://drive.google.com/..."
                      className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      嵌入資源說明文字
                    </label>
                    <input
                      type="text"
                      value={formState.embedLabel || ''}
                      onChange={(e) =>
                        setFormState({...formState, embedLabel: e.target.value})
                      }
                      placeholder="例如：113 學年度期中會議紀錄 PDF"
                      className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between pt-2">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-stone-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formState.isFeatured}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            isFeatured: e.target.checked,
                          })
                        }
                        className="rounded border-stone-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
                      />
                      <span>設為精選置頂文章</span>
                    </label>

                    <button
                      type="submit"
                      disabled={isSyncing}
                      className="px-5 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-lg hover:bg-[#172554] disabled:bg-stone-400 transition-colors whitespace-nowrap shrink-0"
                    >
                      {isNewPost
                        ? dataSourceMode === 'sheets-api'
                          ? '寫入 Google Sheet'
                          : '新增至工作階段'
                        : dataSourceMode === 'sheets-api'
                        ? '更新 Google Sheet 資料列'
                        : '儲存文章變更'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Existing Posts Table */}
              <section className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
                  <h3 className="font-editorial text-base font-semibold text-stone-900">
                    現有文章清單
                  </h3>
                  <span className="text-xs font-mono-tabular text-stone-500">
                    共 {posts.length} 篇
                  </span>
                </div>
                <div className="divide-y divide-stone-100">
                  {posts.map((p) => (
                    <div
                      key={p.slug}
                      className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-[#FBF9F5] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-stone-900 truncate">
                          {p.title}
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-2">
                          <span className="font-mono-tabular">{p.academicYear}</span>
                          <span>·</span>
                          <span>{p.category}</span>
                          <span>·</span>
                          <span className="font-mono-tabular">{p.publishedAt}</span>
                          {p.rowIndex && (
                            <>
                              <span>·</span>
                              <span className="font-mono-tabular">
                                Row {p.rowIndex}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setFormState({...EMPTY_FORM, ...p});
                            setIsNewPost(false);
                          }}
                          className="p-2 text-stone-500 hover:text-[#1E3A8A] rounded-md hover:bg-stone-100 transition-colors"
                          aria-label={`編輯 ${p.title}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePost(p)}
                          className="p-2 text-stone-500 hover:text-red-700 rounded-md hover:bg-red-50 transition-colors"
                          aria-label={`刪除 ${p.title}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'rss' && (
            <div className="space-y-6">
              <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <div>
                  <h3 className="font-editorial text-base font-semibold text-stone-900">
                    從 Google Blogger / RSS Feed 批次匯入文章
                  </h3>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    輸入舊版 Blogger Feed 網址（例如 <code className="font-mono-tabular bg-[#F7F4EE] px-1.5 py-0.5 rounded">https://ximen-math.blogspot.com/feeds/posts/default?max-results=500</code>），系統會自動解析學年度標籤、分類、內文圖片與雲端附件連結，無跨來源限制，可直接在 GitHub Pages 執行。
                  </p>
                </div>

                {rssError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 leading-relaxed">
                    {rssError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="url"
                    value={rssUrl}
                    onChange={(e) => setRssUrl(e.target.value)}
                    placeholder="https://ximen-math.blogspot.com/feeds/posts/default?max-results=500"
                    className="flex-1 px-3.5 py-2 text-sm font-mono-tabular bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                  />
                  <button
                    type="button"
                    onClick={handleFetchRss}
                    disabled={isFetchingRss || !rssUrl.trim()}
                    className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-lg hover:bg-[#172554] disabled:bg-stone-400 inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        isFetchingRss ? 'animate-spin' : ''
                      }`}
                    />
                    <span>
                      {isFetchingRss ? '抓取中...' : '抓取 RSS / Blogger 文章'}
                    </span>
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowXmlFallback((v) => !v)}
                    className="text-xs text-stone-500 hover:text-[#1E3A8A] underline underline-offset-2"
                  >
                    {showXmlFallback
                      ? '隱藏 XML 原始碼匯入區'
                      : '其他網站有 CORS 限制？改用貼上 RSS / Atom XML 原始碼'}
                  </button>

                  {showXmlFallback && (
                    <div className="mt-3 space-y-2.5">
                      <textarea
                        rows={5}
                        value={rssXmlFallback}
                        onChange={(e) => setRssXmlFallback(e.target.value)}
                        placeholder="在此貼上從瀏覽器複製的 <feed> 或 <rss> XML 完整內容..."
                        className="w-full px-3.5 py-2 text-xs font-mono-tabular border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                      />
                      <button
                        type="button"
                        onClick={handleParseXmlFallback}
                        disabled={!rssXmlFallback.trim()}
                        className="px-3.5 py-1.5 text-xs font-medium text-stone-800 bg-[#F7F4EE] border border-stone-300 rounded-lg hover:bg-stone-200/70 disabled:opacity-50"
                      >
                        解析 XML 內容
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {rssResult && (
                <section className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 bg-[#F7F4EE] border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-stone-900">
                        {rssResult.feedTitle}
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5 font-mono-tabular">
                        共讀取 {rssResult.posts.length} 篇文章（來源總計 {rssResult.totalReported} 筆）· 已選取 {rssPostsToImport.length} 篇準備匯入
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipDuplicates}
                          onChange={(e) => setSkipDuplicates(e.target.checked)}
                          className="rounded border-stone-300 text-[#1E3A8A]"
                        />
                        <span>略過已存在文章</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          if (selectedSlugs.size === rssResult.posts.length) {
                            setSelectedSlugs(new Set());
                          } else {
                            setSelectedSlugs(
                              new Set(rssResult.posts.map((p) => p.slug)),
                            );
                          }
                        }}
                        className="text-xs font-medium text-[#1E3A8A] hover:underline whitespace-nowrap shrink-0"
                      >
                        {selectedSlugs.size === rssResult.posts.length
                          ? '全部取消'
                          : '全選'}
                      </button>
                    </div>
                  </div>

                  {dataSourceMode !== 'sheets-api' && (
                    <div className="px-6 py-3 bg-amber-50/70 border-b border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
                      <span>
                        若要直接批次寫入 Google Sheet，請先於「Google Sheets 連線」分頁登入並以 **API 讀寫連線** 連結您的試算表；若直接匯入則僅於目前頁面預覽。
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('sheets')}
                        className="font-medium underline underline-offset-2 whitespace-nowrap shrink-0 text-left"
                      >
                        前往 API 讀寫連線
                      </button>
                    </div>
                  )}

                  <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
                    {rssResult.posts.map((p) => {
                      const dup = isDuplicatePost(p);
                      const checked =
                        selectedSlugs.has(p.slug) && !(skipDuplicates && dup);
                      return (
                        <label
                          key={p.slug}
                          className={`px-6 py-3 flex items-start gap-3 cursor-pointer hover:bg-[#FBF9F5] transition-colors ${
                            skipDuplicates && dup ? 'opacity-50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={skipDuplicates && dup}
                            onChange={() => toggleSelectSlug(p.slug)}
                            className="mt-1 rounded border-stone-300 text-[#1E3A8A]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-stone-900 truncate">
                              {p.title}
                            </div>
                            <div className="text-xs text-stone-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="font-mono-tabular">
                                {p.academicYear}
                              </span>
                              <span>·</span>
                              <span>{p.category}</span>
                              <span>·</span>
                              <span className="font-mono-tabular">
                                {p.publishedAt}
                              </span>
                              {dup && (
                                <>
                                  <span>·</span>
                                  <span className="text-amber-800 font-medium">
                                    已存在於目前資料中
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="px-6 py-4 bg-[#F7F4EE] border-t border-stone-200 flex items-center justify-between gap-4">
                    <span className="text-xs text-stone-600">
                      {dataSourceMode === 'sheets-api'
                        ? `將批次新增至試算表「${sheetMeta?.title}」`
                        : '將匯入至目前頁面預覽（可再匯出 JSON/CSV）'}
                    </span>
                    <button
                      type="button"
                      disabled={rssPostsToImport.length === 0 || isSyncing}
                      onClick={() => onBatchImportPosts(rssPostsToImport)}
                      className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-lg hover:bg-[#172554] disabled:bg-stone-400 transition-colors whitespace-nowrap shrink-0"
                    >
                      {dataSourceMode === 'sheets-api'
                        ? `批次寫入 Google Sheet (${rssPostsToImport.length} 篇)`
                        : `匯入選取文章 (${rssPostsToImport.length} 篇)`}
                    </button>
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === 'architecture' && (
            <div className="space-y-6">
              {/* Architectural Comparison Table */}
              <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#1E3A8A]" />
                  <h3 className="font-editorial text-base font-semibold text-stone-900">
                    GitHub Pages 靜態網站的後端資料庫方案比較
                  </h3>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  GitHub Pages 僅提供靜態檔案託管（無 Node/Python 伺服器執行環境），但依然能透過前端 API 呼叫達成動態資料呈現與後台管理：
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 bg-[#F7F4EE]">
                        <th className="py-2.5 px-3 font-semibold text-stone-900">
                          資料庫架構
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-stone-900">
                          讀寫能力
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-stone-900">
                          更新後需重新部署嗎？
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-stone-900">
                          適用場景
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-stone-700">
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-[#1E3A8A]">
                          Google Sheets（本系統已整合）
                        </td>
                        <td className="py-2.5 px-3">
                          公開訪客可即時讀取（GViz）；授權登入可線上寫入與刪除
                        </td>
                        <td className="py-2.5 px-3">不需要，試算表一改網頁即時更新</td>
                        <td className="py-2.5 px-3">
                          教師社群共筆、活動紀錄、無伺服器 CMS
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-stone-900">
                          SQLite 檔案型（sql.js WASM）
                        </td>
                        <td className="py-2.5 px-3">
                          瀏覽器端唯讀 SQL 查詢（透過 HTTP Range 分段讀取 .sqlite）
                        </td>
                        <td className="py-2.5 px-3">更新 .sqlite 檔案後需推回 GitHub</td>
                        <td className="py-2.5 px-3">
                          數萬筆以上題庫、複雜關聯檢索與全文搜尋
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-stone-900">
                          靜態 JSON / CSV 快照
                        </td>
                        <td className="py-2.5 px-3">超高速靜態載入（零外部 API 延遲）</td>
                        <td className="py-2.5 px-3">更新檔案後經 GitHub Actions 自動建置</td>
                        <td className="py-2.5 px-3">
                          封存歷史學年度期刊、離線高速瀏覽
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Export / Import Snapshot Tools */}
              <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <h3 className="font-editorial text-base font-semibold text-stone-900">
                  靜態資料庫匯出與本機匯入
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  您可隨時將目前試算表或期刊文章匯出為標準 JSON 或 CSV 檔，作為 GitHub Repository 的靜態備份或匯入至 Google Sheets。
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        exportPostsAsJson(posts),
                        'pesmath-journal-db.json',
                        'application/json',
                      )
                    }
                    className="px-4 py-2 text-xs font-medium text-stone-800 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>匯出 JSON 資料庫</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        exportPostsAsCsv(posts),
                        'pesmath-journal-db.csv',
                        'text/csv;charset=utf-8;',
                      )
                    }
                    className="px-4 py-2 text-xs font-medium text-stone-800 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>匯出 CSV 試算表</span>
                  </button>

                  <label className="px-4 py-2 text-xs font-medium text-[#1E3A8A] bg-white border border-[#1E3A8A]/30 rounded-lg hover:bg-[#1E3A8A]/5 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>匯入本機 JSON 預覽</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleJsonUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                {importError && (
                  <p className="text-xs text-red-700">{importError}</p>
                )}
              </section>

              {/* GitHub Pages Deployment Workflow */}
              <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-editorial text-base font-semibold text-stone-900">
                    GitHub Pages 自動部署工作流（.github/workflows/deploy.yml）
                  </h3>
                  <button
                    type="button"
                    onClick={() => copyText(GITHUB_ACTIONS_YML, 'gha')}
                    className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-50 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    {copiedId === 'gha' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>已複製</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>複製 YAML</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 rounded-lg bg-stone-900 text-stone-100 text-xs font-mono-tabular overflow-x-auto leading-relaxed">
                  {GITHUB_ACTIONS_YML}
                </pre>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
