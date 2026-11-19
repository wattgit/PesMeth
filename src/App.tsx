/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {User} from 'firebase/auth';
import {
  ArrowUpRight,
  BookOpen,
  ExternalLink,
  FileText,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  Sheet,
} from 'lucide-react';
import {ArticleCard} from './components/ArticleCard';
import {ArticleReaderModal} from './components/ArticleReaderModal';
import {ConfirmActionModal} from './components/ConfirmActionModal';
import {GoogleSignInButton} from './components/GoogleSignInButton';
import {DrawerTab, SheetsCmsDrawer} from './components/SheetsCmsDrawer';
import {
  DEFAULT_PUBLIC_SHEET_ID,
  DEFAULT_PUBLIC_SHEET_TAB,
} from './config/siteConfig';
import {SEED_POSTS} from './data/seedPosts';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/googleAuth';
import {
  appendPostToSheet,
  batchAppendPostsToSheet,
  createAndSeedJournalSheet,
  deletePostFromSheet,
  fetchPostsFromPublicGviz,
  fetchPostsFromSheetsApi,
  fetchSpreadsheetMeta,
  updatePostInSheet,
} from './services/sheetsDb';
import {
  ConfirmActionState,
  DataSourceMode,
  JournalPost,
  SpreadsheetMeta,
} from './types/journal';

const PUBLIC_SHEET_STORAGE_KEY = 'pesmath_public_sheet_id';

export default function App() {
  // Data & Source State
  const [posts, setPosts] = useState<JournalPost[]>(SEED_POSTS);
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('seed');
  const [sheetMeta, setSheetMeta] = useState<SpreadsheetMeta | null>(null);
  const [publicSheetId, setPublicSheetId] = useState<string>('');
  const [publicTabName, setPublicTabName] = useState<string | undefined>(
    undefined,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Auth State (Access token kept strictly in memory via googleAuth.ts)
  const [user, setUser] = useState<User | null>(null);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Filter & View State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('全部年度');
  const [selectedCategory, setSelectedCategory] = useState<string>('全部分類');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [includeDrafts, setIncludeDrafts] = useState(false);

  // Modals & Drawers
  const [activePost, setActivePost] = useState<JournalPost | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState<DrawerTab>('sheets');
  const [editingPost, setEditingPost] = useState<JournalPost | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmActionState | null>(
    null,
  );

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setHasAccessToken(Boolean(token));
      },
      (maybeUser) => {
        setUser(maybeUser);
        setHasAccessToken(false);
      },
    );
    return () => unsubscribe();
  }, []);

  // Load public Google Sheet from URL query parameter (?sheet=ID) or saved config
  const loadPublicSheet = useCallback(
    async (spreadsheetId: string, tabName?: string) => {
      if (!spreadsheetId) return;
      setIsSyncing(true);
      setSyncError(null);
      try {
        const fetched = await fetchPostsFromPublicGviz(spreadsheetId, tabName);
        if (fetched.length === 0) {
          throw new Error(
            '試算表中尚未找到文章資料列，請確認第一列為欄位名稱（Title, Category, AcademicYear...）。',
          );
        }
        setPosts(fetched);
        setPublicSheetId(spreadsheetId);
        setPublicTabName(tabName);
        setSheetMeta(null);
        setDataSourceMode('sheets-public');
        localStorage.setItem(PUBLIC_SHEET_STORAGE_KEY, spreadsheetId);
      } catch (err: any) {
        setSyncError(err?.message || '讀取公開試算表失敗。');
      } finally {
        setIsSyncing(false);
      }
    },
    [],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sheetParam = params.get('sheet');
    if (sheetParam) {
      loadPublicSheet(sheetParam);
    } else if (DEFAULT_PUBLIC_SHEET_ID) {
      loadPublicSheet(DEFAULT_PUBLIC_SHEET_ID, DEFAULT_PUBLIC_SHEET_TAB);
    } else {
      const savedSheetId = localStorage.getItem(PUBLIC_SHEET_STORAGE_KEY);
      if (savedSheetId) {
        setPublicSheetId(savedSheetId);
      }
    }
  }, [loadPublicSheet]);

  // Deep-link hash support (#post=slug)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#post=')) {
      const slug = decodeURIComponent(hash.slice('#post='.length));
      const found = posts.find((p) => p.slug === slug);
      if (found) setActivePost(found);
    }
  }, [posts]);

  // Derived filter options
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      if (p.academicYear) set.add(p.academicYear);
    });
    return ['全部年度', ...Array.from(set)];
  }, [posts]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['全部分類', ...Array.from(set)];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts
      .filter((p) => {
        if (!includeDrafts && p.status === 'Draft') return false;
        if (selectedYear !== '全部年度' && p.academicYear !== selectedYear) {
          return false;
        }
        if (selectedCategory !== '全部分類' && p.category !== selectedCategory) {
          return false;
        }
        if (q) {
          const haystack = [
            p.title,
            p.summary,
            p.content,
            p.author,
            p.category,
            p.academicYear,
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
        return b.publishedAt.localeCompare(a.publishedAt);
      });
  }, [posts, includeDrafts, selectedYear, selectedCategory, searchQuery]);

  const leadPost = filteredPosts[0] || null;
  const remainingPosts =
    viewMode === 'grid' &&
    selectedYear === '全部年度' &&
    selectedCategory === '全部分類' &&
    !searchQuery.trim() &&
    leadPost
      ? filteredPosts.slice(1)
      : filteredPosts;

  const embedCount = useMemo(
    () => posts.filter((p) => Boolean(p.embedUrl)).length,
    [posts],
  );

  // Auth handlers
  const handleSignIn = async () => {
    setIsSigningIn(true);
    setSyncError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setHasAccessToken(true);
        const targetId = publicSheetId || DEFAULT_PUBLIC_SHEET_ID;
        if (targetId && dataSourceMode !== 'sheets-api') {
          try {
            const meta = await fetchSpreadsheetMeta(targetId, result.accessToken);
            const fetched = await fetchPostsFromSheetsApi(
              meta.spreadsheetId,
              meta.activeTab,
              result.accessToken,
            );
            setSheetMeta(meta);
            setPosts(fetched);
            setPublicSheetId(meta.spreadsheetId);
            setDataSourceMode('sheets-api');
          } catch {
            // Keep existing view if signed-in account lacks permission on the public sheet
          }
        }
      }
    } catch (err: any) {
      setSyncError(err?.message || 'Google 登入授權失敗，請再試一次。');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setHasAccessToken(false);
    if (dataSourceMode === 'sheets-api') {
      setDataSourceMode(publicSheetId ? 'sheets-public' : 'seed');
    }
  };

  // Sheets API Connection Handlers
  const handleConnectSheetApi = async (spreadsheetId: string) => {
    const token = getAccessToken();
    if (!token) {
      setSyncError('請先點擊「Sign in with Google」完成授權後再連線。');
      return;
    }
    setIsSyncing(true);
    setSyncError(null);
    try {
      const meta = await fetchSpreadsheetMeta(spreadsheetId, token);
      const fetched = await fetchPostsFromSheetsApi(
        meta.spreadsheetId,
        meta.activeTab,
        token,
      );
      setSheetMeta(meta);
      setPosts(fetched);
      setPublicSheetId(meta.spreadsheetId);
      setDataSourceMode('sheets-api');
      localStorage.setItem(PUBLIC_SHEET_STORAGE_KEY, meta.spreadsheetId);
    } catch (err: any) {
      setSyncError(err?.message || '連線 Google Sheet API 失敗。');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSwitchSheetTab = async (tabName: string) => {
    const token = getAccessToken();
    if (!token || !sheetMeta) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const fetched = await fetchPostsFromSheetsApi(
        sheetMeta.spreadsheetId,
        tabName,
        token,
      );
      setSheetMeta({...sheetMeta, activeTab: tabName});
      setPosts(fetched);
    } catch (err: any) {
      setSyncError(err?.message || '切換工作表分頁失敗。');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRefreshSync = async () => {
    if (dataSourceMode === 'sheets-api' && sheetMeta) {
      const token = getAccessToken();
      if (!token) {
        setSyncError('授權工作階段已過期，請重新登入 Google。');
        return;
      }
      setIsSyncing(true);
      setSyncError(null);
      try {
        const fetched = await fetchPostsFromSheetsApi(
          sheetMeta.spreadsheetId,
          sheetMeta.activeTab,
          token,
        );
        setPosts(fetched);
      } catch (err: any) {
        setSyncError(err?.message || '重新同步 Google Sheet 失敗。');
      } finally {
        setIsSyncing(false);
      }
    } else if (dataSourceMode === 'sheets-public' && publicSheetId) {
      await loadPublicSheet(publicSheetId, publicTabName);
    }
  };

  const handleCreateNewSheet = () => {
    const token = getAccessToken();
    if (!token) {
      setSyncError('請先登入 Google 帳號以建立新的試算表資料庫。');
      return;
    }
    setConfirmState({
      isOpen: true,
      title: '建立並初始化 Google Sheet 資料庫',
      description:
        '系統將在您的 Google 雲端硬碟建立名為「PesMath 數學教學社群資料庫」的新試算表，並自動寫入目前示範文章作為初始資料。',
      details: [
        '工作表分頁名稱：Posts',
        `寫入初始文章數量：${SEED_POSTS.length} 筆`,
      ],
      confirmLabel: '確認建立並寫入',
      isDestructive: false,
      onConfirm: async () => {
        setIsSyncing(true);
        setSyncError(null);
        try {
          const {meta, posts: createdPosts} = await createAndSeedJournalSheet(
            token,
            SEED_POSTS,
          );
          setSheetMeta(meta);
          setPosts(createdPosts);
          setPublicSheetId(meta.spreadsheetId);
          setDataSourceMode('sheets-api');
          localStorage.setItem(PUBLIC_SHEET_STORAGE_KEY, meta.spreadsheetId);
        } catch (err: any) {
          setSyncError(err?.message || '建立試算表失敗。');
        } finally {
          setIsSyncing(false);
        }
      },
    });
  };

  const handleSavePost = (post: JournalPost, isNew: boolean) => {
    if (dataSourceMode === 'sheets-api' && sheetMeta) {
      const token = getAccessToken();
      if (!token) {
        setSyncError('授權工作階段已過期，請重新登入 Google。');
        return;
      }

      setConfirmState({
        isOpen: true,
        title: isNew
          ? '確認新增文章至 Google Sheet？'
          : '確認更新 Google Sheet 文章內容？',
        description: isNew
          ? `即將在試算表「${sheetMeta.title}」的「${sheetMeta.activeTab}」分頁新增一筆文章資料列。`
          : `即將覆寫試算表「${sheetMeta.title}」第 ${post.rowIndex} 列的現有文章內容。`,
        details: [
          `文章標題：${post.title}`,
          `學年度與分類：${post.academicYear} · ${post.category}`,
          `發布狀態：${post.status}`,
        ],
        confirmLabel: isNew ? '確認寫入試算表' : '確認更新資料列',
        isDestructive: false,
        onConfirm: async () => {
          setIsSyncing(true);
          setSyncError(null);
          try {
            if (isNew || !post.rowIndex) {
              await appendPostToSheet(
                sheetMeta.spreadsheetId,
                sheetMeta.activeTab,
                post,
                token,
              );
            } else {
              await updatePostInSheet(
                sheetMeta.spreadsheetId,
                sheetMeta.activeTab,
                post.rowIndex,
                post,
                token,
              );
            }
            const refreshed = await fetchPostsFromSheetsApi(
              sheetMeta.spreadsheetId,
              sheetMeta.activeTab,
              token,
            );
            setPosts(refreshed);
            setEditingPost(null);
          } catch (err: any) {
            setSyncError(err?.message || '寫入 Google Sheet 失敗。');
          } finally {
            setIsSyncing(false);
          }
        },
      });
    } else {
      // Session-only update when browsing local seed or JSON snapshot
      setPosts((prev) => {
        if (isNew) {
          return [post, ...prev];
        }
        return prev.map((item) => (item.slug === post.slug ? post : item));
      });
      setEditingPost(null);
    }
  };

  const handleDeletePost = (post: JournalPost) => {
    const isSheetsApi = dataSourceMode === 'sheets-api' && sheetMeta;
    const activeTabObj = sheetMeta?.tabs.find(
      (t) => t.title === sheetMeta.activeTab,
    );

    setConfirmState({
      isOpen: true,
      title: isSheetsApi
        ? '確認從 Google Sheet 永久刪除此文章？'
        : '確認從目前清單移除此文章？',
      description: isSheetsApi
        ? `此操作將會從試算表「${sheetMeta?.title}」直接刪除第 ${post.rowIndex} 列資料，刪除後無法自動復原。`
        : '此操作將從目前的靜態展示清單中移除該篇文章（不會影響外部檔案）。',
      details: [
        `文章標題：${post.title}`,
        `索引代碼：${post.slug}`,
      ],
      confirmLabel: '確認刪除',
      isDestructive: true,
      onConfirm: async () => {
        if (isSheetsApi && sheetMeta && activeTabObj && post.rowIndex) {
          const token = getAccessToken();
          if (!token) {
            setSyncError('授權工作階段已過期，請重新登入 Google。');
            return;
          }
          setIsSyncing(true);
          setSyncError(null);
          try {
            await deletePostFromSheet(
              sheetMeta.spreadsheetId,
              activeTabObj.sheetId,
              post.rowIndex,
              token,
            );
            const refreshed = await fetchPostsFromSheetsApi(
              sheetMeta.spreadsheetId,
              sheetMeta.activeTab,
              token,
            );
            setPosts(refreshed);
            if (activePost?.slug === post.slug) {
              setActivePost(null);
            }
          } catch (err: any) {
            setSyncError(err?.message || '刪除 Google Sheet 資料列失敗。');
          } finally {
            setIsSyncing(false);
          }
        } else {
          setPosts((prev) => prev.filter((item) => item.slug !== post.slug));
          if (activePost?.slug === post.slug) {
            setActivePost(null);
          }
        }
      },
    });
  };

  const handleBatchImportPosts = (importedPosts: JournalPost[]) => {
    if (importedPosts.length === 0) return;

    if (dataSourceMode === 'sheets-api' && sheetMeta) {
      const token = getAccessToken();
      if (!token) {
        setSyncError('授權工作階段已過期，請重新登入 Google。');
        return;
      }

      setConfirmState({
        isOpen: true,
        title: `確認批次匯入 ${importedPosts.length} 篇文章至 Google Sheet？`,
        description: `即將把從 RSS / Blogger 選取的文章附加至試算表「${sheetMeta.title}」的「${sheetMeta.activeTab}」分頁。`,
        details: [
          `匯入文章數量：${importedPosts.length} 篇`,
          `首篇範例：${importedPosts[0].title}`,
        ],
        confirmLabel: `確認寫入 ${importedPosts.length} 篇文章`,
        isDestructive: false,
        onConfirm: async () => {
          setIsSyncing(true);
          setSyncError(null);
          try {
            await batchAppendPostsToSheet(
              sheetMeta.spreadsheetId,
              sheetMeta.activeTab,
              importedPosts,
              token,
            );
            const refreshed = await fetchPostsFromSheetsApi(
              sheetMeta.spreadsheetId,
              sheetMeta.activeTab,
              token,
            );
            setPosts(refreshed);
          } catch (err: any) {
            setSyncError(err?.message || '批次寫入 Google Sheet 失敗。');
          } finally {
            setIsSyncing(false);
          }
        },
      });
    } else {
      setPosts((prev) => {
        const existingSlugs = new Set(prev.map((p) => p.slug));
        const uniqueIncoming = importedPosts.filter(
          (p) => !existingSlugs.has(p.slug),
        );
        return [...uniqueIncoming, ...prev];
      });
      setDataSourceMode('local-json');
      setIsDrawerOpen(false);
    }
  };

  const openDrawer = (tab: DrawerTab, postToEdit: JournalPost | null = null) => {
    if (!user || !hasAccessToken) {
      handleSignIn();
      return;
    }
    setDrawerInitialTab(tab);
    setEditingPost(postToEdit);
    setIsDrawerOpen(true);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
  };

  const dataSourceLabel =
    dataSourceMode === 'sheets-api'
      ? `Google Sheets API (${sheetMeta?.title || '已連線'})`
      : dataSourceMode === 'sheets-public'
      ? '公開 Google Sheet (唯讀即時同步)'
      : dataSourceMode === 'local-json'
      ? '匯入 JSON 靜態資料集'
      : '內建示範資料庫 (可即時切換試算表)';

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#1C1917]">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#FBF9F5]/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setSelectedYear('全部年度');
              setSelectedCategory('全部分類');
              setViewMode('grid');
              window.scrollTo({top: 0, behavior: 'smooth'});
            }}
            className="font-editorial text-xl font-bold tracking-tight text-stone-950 whitespace-nowrap shrink-0"
          >
            PesMath 數學期刊
          </a>

          {/* Zone 2: 4 Single-line Text Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('全部分類');
                setViewMode('grid');
                scrollToSection('journal-catalog');
              }}
              className="hover:text-stone-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              期刊專欄
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('教學資源');
                setViewMode('grid');
                scrollToSection('journal-catalog');
              }}
              className="hover:text-stone-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              教學資源
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('學力檢測');
                setViewMode('grid');
                scrollToSection('journal-catalog');
              }}
              className="hover:text-stone-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              學力檢測
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('全部分類');
                setViewMode('list');
                scrollToSection('journal-catalog');
              }}
              className="hover:text-stone-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              年度彙編
            </button>
          </nav>

          {/* Zone 3: 1 Primary CTA */}
          <div className="flex items-center shrink-0">
            {user && hasAccessToken ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDrawer('editor')}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#1E3A8A] rounded-lg hover:bg-[#172554] transition-colors whitespace-nowrap shrink-0"
                >
                  管理後台
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors whitespace-nowrap shrink-0"
                >
                  登出
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="px-3.5 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors whitespace-nowrap shrink-0"
              >
                {isSigningIn ? '登入中...' : '教師登入'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Editorial Hero / Lead Featured Story */}
        <section className="border-b border-stone-200 bg-white">
          <div className="max-w-7xl mx-auto px-6 py-10 lg:py-14">
            <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-stone-200">
              <div className="space-y-3 max-w-2xl">
                <p className="text-xs font-mono-tabular tracking-widest uppercase text-stone-500">
                  PesMath 數學教學社群 · 期刊與知識專欄
                </p>
                <h1 className="font-editorial text-3xl sm:text-5xl font-semibold text-stone-950 leading-[1.15] text-balance">
                  數學教案、研究專欄與領域共備知識庫
                </h1>
                <p className="text-base text-stone-600 leading-relaxed">
                  彙整歷學年度領域會議紀錄、趣味數學桌遊與繪本實作、學力檢測數據分析及雲端教案資源。支援純靜態 GitHub Pages 部署與 Google Sheets 即時動態存取。
                </p>
              </div>

              {/* Only show management controls when teacher is logged in */}
              {user && hasAccessToken && (
                <div className="bg-[#FBF9F5] border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                  <div className="text-xs">
                    <div className="font-semibold text-stone-900">
                      {user.displayName || user.email}
                    </div>
                    <div className="text-stone-500 mt-0.5">
                      已啟用 Google Sheets 授權連線
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openDrawer('editor')}
                    className="px-3.5 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-lg hover:bg-[#172554] transition-colors whitespace-nowrap shrink-0"
                  >
                    進入管理後台
                  </button>
                </div>
              )}
            </div>

            {/* Lead Story Split (Tier 1 Editorial Salience) */}
            {leadPost ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
                <div className="lg:col-span-7">
                  <button
                    type="button"
                    onClick={() => setActivePost(leadPost)}
                    className="block w-full h-full min-h-[260px] lg:min-h-[360px] rounded-xl overflow-hidden border border-stone-200 bg-[#F7F4EE] text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                  >
                    {leadPost.coverImageUrl ? (
                      <img
                        src={leadPost.coverImageUrl}
                        alt={leadPost.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="w-full h-full p-8 flex flex-col justify-between">
                        <span className="text-xs font-mono-tabular text-stone-500">
                          {leadPost.academicYear} · {leadPost.category}
                        </span>
                        <span className="font-editorial text-2xl font-semibold text-stone-900">
                          {leadPost.title}
                        </span>
                      </div>
                    )}
                  </button>
                </div>

                <div className="lg:col-span-5 flex flex-col justify-between py-1 space-y-6">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
                      <span className="font-semibold text-[#1E3A8A]">
                        本期焦點文章
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        {leadPost.academicYear}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{leadPost.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        {leadPost.publishedAt}
                      </span>
                    </div>

                    <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-stone-950 leading-snug text-balance">
                      <button
                        type="button"
                        onClick={() => setActivePost(leadPost)}
                        className="text-left hover:text-[#1E3A8A] transition-colors"
                      >
                        {leadPost.title}
                      </button>
                    </h2>

                    <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
                      {leadPost.summary}
                    </p>
                  </div>

                  <div className="pt-5 border-t border-stone-200 flex flex-wrap items-center justify-between gap-4">
                    <span className="text-xs text-stone-500">
                      撰稿：{leadPost.author}
                    </span>
                    <div className="flex items-center gap-3">
                      {leadPost.embedUrl && (
                        <a
                          href={leadPost.embedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 text-xs font-medium text-stone-700 bg-[#F7F4EE] border border-stone-200 rounded-lg hover:bg-stone-200/70 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                        >
                          <span>雲端附件</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setActivePost(leadPost)}
                        className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-lg hover:bg-[#172554] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>閱讀全文</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* 4-Column Operational Utility Strip (Full-Width Below Hero Split) */}
            <div className="mt-10 pt-8 border-t border-stone-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <div className="text-xs text-stone-500">收錄期刊與紀錄</div>
                <div className="font-mono-tabular text-2xl font-semibold text-stone-950 mt-1">
                  {posts.length} 篇
                </div>
              </div>
              <div>
                <div className="text-xs text-stone-500">涵蓋學年度跨距</div>
                <div className="font-mono-tabular text-2xl font-semibold text-stone-950 mt-1">
                  {Math.max(1, availableYears.length - 1)} 個學年
                </div>
              </div>
              <div>
                <div className="text-xs text-stone-500">雲端附件與表單</div>
                <div className="font-mono-tabular text-2xl font-semibold text-stone-950 mt-1">
                  {embedCount} 筆資源
                </div>
              </div>
              <div>
                <div className="text-xs text-stone-500 flex items-center justify-between gap-2">
                  <span>{user && hasAccessToken ? '資料庫來源狀態' : '資料庫狀態'}</span>
                  {user &&
                    hasAccessToken &&
                    (dataSourceMode === 'sheets-api' ||
                      dataSourceMode === 'sheets-public') && (
                      <button
                        type="button"
                        onClick={handleRefreshSync}
                        disabled={isSyncing}
                        className="text-[#1E3A8A] hover:underline inline-flex items-center gap-1 text-xs font-medium"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`}
                        />
                        <span>同步</span>
                      </button>
                    )}
                </div>
                <div className="text-sm font-semibold text-stone-900 mt-1.5 truncate">
                  {user && hasAccessToken
                    ? dataSourceLabel
                    : '雲端即時連線（最新期刊）'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Journal Catalog & Interactive Filter Workspace */}
        <section id="journal-catalog" className="max-w-7xl mx-auto px-6 py-10 lg:py-12 space-y-8">
          {/* Search & Filter Controls */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-lg">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋文章標題、數學單元、作者或摘要..."
                  className="w-full pl-10 pr-4 py-2 text-sm bg-[#FBF9F5] border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:bg-white transition-colors"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {user && hasAccessToken && (
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-stone-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDrafts}
                      onChange={(e) => setIncludeDrafts(e.target.checked)}
                      className="rounded border-stone-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
                    />
                    <span>顯示草稿</span>
                  </label>
                )}

                <div className="flex items-center gap-1 p-1 bg-[#F7F4EE] border border-stone-200 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      viewMode === 'grid'
                        ? 'bg-white text-stone-950 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>卡片排版</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      viewMode === 'list'
                        ? 'bg-white text-stone-950 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>目錄清單</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Academic Year Filter Tabs */}
            <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-stone-500 mr-1">
                學年度：
              </span>
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    selectedYear === yr
                      ? 'bg-[#1E3A8A] text-white'
                      : 'bg-[#F7F4EE] text-stone-700 hover:bg-stone-200/70'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-stone-500 mr-1">
                專欄分類：
              </span>
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Results Header */}
          <div className="flex items-center justify-between gap-4 border-b border-stone-200 pb-3">
            <h2 className="font-editorial text-xl font-semibold text-stone-900">
              {selectedCategory === '全部分類' ? '所有期刊文章' : selectedCategory}
              {selectedYear !== '全部年度' ? ` · ${selectedYear}` : ''}
            </h2>
            <span className="text-xs font-mono-tabular text-stone-500">
              顯示 {filteredPosts.length} 筆結果
            </span>
          </div>

          {/* Empty State */}
          {filteredPosts.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-12 text-center space-y-3">
              <BookOpen className="w-8 h-8 text-stone-400 mx-auto" />
              <h3 className="font-editorial text-lg font-medium text-stone-900">
                找不到符合條件的期刊文章
              </h3>
              <p className="text-sm text-stone-600 max-w-md mx-auto">
                請嘗試清除關鍵字或切換其他學年度與分類標籤。
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedYear('全部年度');
                  setSelectedCategory('全部分類');
                }}
                className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-lg hover:bg-[#172554] transition-colors"
              >
                重設所有篩選條件
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(remainingPosts.length > 0 ? remainingPosts : filteredPosts).map(
                (post) => (
                  <ArticleCard
                    key={post.slug}
                    post={post}
                    onSelect={(p) => setActivePost(p)}
                  />
                ),
              )}
            </div>
          ) : (
            /* Chronological Archive Table View */
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F7F4EE] border-b border-stone-200 text-xs font-semibold text-stone-700">
                      <th className="py-3.5 px-5 whitespace-nowrap">學年度</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">發布日期</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">分類</th>
                      <th className="py-3.5 px-4">文章標題</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">雲端資源</th>
                      <th className="py-3.5 px-5 text-right whitespace-nowrap">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-sm">
                    {filteredPosts.map((post) => (
                      <tr
                        key={post.slug}
                        className="hover:bg-[#FBF9F5] transition-colors"
                      >
                        <td className="py-3.5 px-5 font-mono-tabular text-xs text-stone-600 whitespace-nowrap">
                          {post.academicYear}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-xs text-stone-500 whitespace-nowrap">
                          {post.publishedAt}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-stone-700 whitespace-nowrap">
                          {post.category}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => setActivePost(post)}
                            className="text-left font-medium text-stone-900 hover:text-[#1E3A8A] transition-colors"
                          >
                            {post.title}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-stone-500 whitespace-nowrap">
                          {post.embedUrl ? (
                            <a
                              href={post.embedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#1E3A8A] hover:underline"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>開啟附件</span>
                            </a>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setActivePost(post)}
                            className="text-xs font-medium text-[#1E3A8A] hover:underline"
                          >
                            閱讀全文
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Clean Institutional Footer */}
      <footer className="border-t border-stone-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-stone-500">
          <div className="space-y-1">
            <div className="font-editorial text-sm font-semibold text-stone-900">
              PesMath 數學教學社群 | 期刊與知識專欄
            </div>
            <div>
              支援靜態 GitHub Pages 託管 · 可連結 Google Sheets 試算表作為即時資料庫
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {user && hasAccessToken ? (
              <>
                <button
                  type="button"
                  onClick={() => openDrawer('sheets')}
                  className="inline-flex items-center gap-1.5 text-stone-700 hover:text-[#1E3A8A] font-medium"
                >
                  <Sheet className="w-3.5 h-3.5" />
                  <span>管理後台與連線設定</span>
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-stone-500 hover:text-stone-900"
                >
                  登出
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="text-stone-600 hover:text-[#1E3A8A] font-medium transition-colors"
              >
                {isSigningIn ? '登入中...' : '社群教師登入'}
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Article Full-Text Reader Modal */}
      <ArticleReaderModal
        post={activePost}
        allPosts={filteredPosts}
        canEdit={Boolean(user && hasAccessToken)}
        onClose={() => {
          setActivePost(null);
          if (window.location.hash.startsWith('#post=')) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }}
        onSelectPost={(p) => setActivePost(p)}
        onEditPost={(p) => {
          setActivePost(null);
          openDrawer('editor', p);
        }}
      />

      {/* Google Sheets CMS & Architecture Drawer */}
      <SheetsCmsDrawer
        isOpen={isDrawerOpen}
        initialTab={drawerInitialTab}
        editingPost={editingPost}
        onClose={() => setIsDrawerOpen(false)}
        user={user}
        hasAccessToken={hasAccessToken}
        isSigningIn={isSigningIn}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        dataSourceMode={dataSourceMode}
        sheetMeta={sheetMeta}
        publicSheetId={publicSheetId}
        isSyncing={isSyncing}
        syncError={syncError}
        posts={posts}
        onCreateNewSheet={handleCreateNewSheet}
        onConnectSheetApi={handleConnectSheetApi}
        onConnectPublicSheet={loadPublicSheet}
        onSwitchSheetTab={handleSwitchSheetTab}
        onRefreshSync={handleRefreshSync}
        onResetToSeed={() => {
          setPosts(SEED_POSTS);
          setSheetMeta(null);
          setDataSourceMode('seed');
          setSyncError(null);
        }}
        onSavePost={handleSavePost}
        onDeletePost={handleDeletePost}
        onImportJsonPosts={(imported) => {
          setPosts(imported);
          setDataSourceMode('local-json');
          setSheetMeta(null);
        }}
        onBatchImportPosts={handleBatchImportPosts}
      />

      {/* Mandatory Explicit Confirmation Dialog for Mutating / Destructive Operations */}
      <ConfirmActionModal
        state={confirmState}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
}
