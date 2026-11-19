import React, {useEffect, useRef, useState} from 'react';
import {marked} from 'marked';
import {
  Bold,
  Code,
  Columns,
  Eye,
  FileCode,
  FileText,
  Heading2,
  Heading3,
  HelpCircle,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Quote,
  Split,
  Strikethrough,
  Table,
  Upload,
  Video,
  X,
  Youtube,
} from 'lucide-react';
import {uploadImageToGoogleDrive} from '../services/driveUpload';

interface RichFormatEditorProps {
  value: string;
  onChange: (newValue: string) => void;
  accessToken?: string | null;
  onSetCoverImage?: (url: string) => void;
}

type ViewMode = 'split' | 'edit' | 'preview';
type InsertModalType = 'image' | 'embed' | null;

export const RichFormatEditor: React.FC<RichFormatEditorProps> = ({
  value,
  onChange,
  accessToken,
  onSetCoverImage,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [modalType, setModalType] = useState<InsertModalType>(null);

  // Image Insert State
  const [imgUrl, setImgUrl] = useState('');
  const [imgAlt, setImgAlt] = useState('');
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [setAsCoverToo, setSetAsCoverToo] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalType !== null) {
        setModalType(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalType]);

  // Embed Insert State
  const [embedUrl, setEmbedUrl] = useState('');
  const [embedLabel, setEmbedLabel] = useState('');
  const [embedType, setEmbedType] = useState<'drive' | 'youtube' | 'forms' | 'meet'>('drive');

  // Insert text at cursor helper
  const insertText = (before: string, after: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || defaultText;

    const replacement = `${before}${selectedText}${after}`;
    const nextValue = value.substring(0, start) + replacement + value.substring(end);

    onChange(nextValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length,
      );
    }, 0);
  };

  // Upload local file to Google Drive and insert into editor
  const handleFileUpload = async (file: File) => {
    if (!accessToken) {
      setUploadError('請先於頂部登入 Google 帳號，才能直接上傳至 Google 雲端硬碟。');
      return;
    }

    setIsUploadingDrive(true);
    setUploadProgressMsg('正在上傳至 Google Drive 並設定公開檢視...');
    setUploadError(null);

    try {
      const res = await uploadImageToGoogleDrive(file, accessToken);
      const markdownImage = `\n![${res.name}](${res.directImageUrl})\n`;
      insertText('', markdownImage, '');

      if (setAsCoverToo && onSetCoverImage) {
        onSetCoverImage(res.directImageUrl);
      }

      setModalType(null);
      setImgUrl('');
      setImgAlt('');
    } catch (err: any) {
      setUploadError(err?.message || '上傳至 Google Drive 失敗。');
    } finally {
      setIsUploadingDrive(false);
      setUploadProgressMsg(null);
    }
  };

  const handleInsertImageUrl = () => {
    if (!imgUrl.trim()) return;
    const alt = imgAlt.trim() || '文章插圖';
    const markdownImage = `\n![${alt}](${imgUrl.trim()})\n`;
    insertText('', markdownImage, '');

    if (setAsCoverToo && onSetCoverImage) {
      onSetCoverImage(imgUrl.trim());
    }

    setModalType(null);
    setImgUrl('');
    setImgAlt('');
  };

  const handleInsertEmbed = () => {
    if (!embedUrl.trim()) return;
    const url = embedUrl.trim();
    const label = embedLabel.trim() || '雲端資源連結';

    let markdownEmbed = '';
    if (embedType === 'youtube') {
      const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (videoIdMatch && videoIdMatch[1]) {
        markdownEmbed = `\n<div class="my-6 aspect-video w-full rounded-xl overflow-hidden shadow-sm border border-stone-200">\n  <iframe src="https://www.youtube.com/embed/${videoIdMatch[1]}" class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>\n</div>\n`;
      } else {
        markdownEmbed = `\n[📺 ${label}](${url})\n`;
      }
    } else if (embedType === 'drive') {
      let previewUrl = url;
      if (url.includes('/file/d/')) {
        previewUrl = url.replace(/\/view.*$/, '/preview');
      }
      markdownEmbed = `\n<div class="my-6 p-4 rounded-xl border border-stone-200 bg-[#F7F4EE] flex items-center justify-between gap-4">\n  <div>\n    <div class="text-xs font-semibold text-stone-900">📄 ${label}</div>\n    <div class="text-[11px] text-stone-500 truncate max-w-md">${url}</div>\n  </div>\n  <a href="${url}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 text-xs font-medium text-white bg-[#1E3A8A] rounded-md hover:bg-[#172554] shrink-0">開啟雲端檔案</a>\n</div>\n`;
    } else if (embedType === 'forms') {
      markdownEmbed = `\n<div class="my-6 p-4 rounded-xl border border-purple-200 bg-purple-50/50 flex items-center justify-between gap-4">\n  <div>\n    <div class="text-xs font-semibold text-purple-950">📝 雲端測驗／問卷表單：${label}</div>\n    <div class="text-[11px] text-purple-700 truncate max-w-md">${url}</div>\n  </div>\n  <a href="${url}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 text-xs font-medium text-white bg-purple-700 rounded-md hover:bg-purple-800 shrink-0">填寫表單</a>\n</div>\n`;
    } else {
      markdownEmbed = `\n<div class="my-6 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between gap-4">\n  <div>\n    <div class="text-xs font-semibold text-emerald-950">📹 Google Meet 視訊共備：${label}</div>\n    <div class="text-[11px] text-emerald-700 font-mono-tabular">${url}</div>\n  </div>\n  <a href="${url}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-800 shrink-0">加入會議</a>\n</div>\n`;
    }

    insertText('', markdownEmbed, '');
    setModalType(null);
    setEmbedUrl('');
    setEmbedLabel('');
  };

  // Safe HTML parser for preview
  const previewHtml = marked.parse(value || '*尚無內文，請於上方輸入內容...*') as string;

  const charCount = value.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const readingTimeMin = Math.max(1, Math.ceil(charCount / 400));

  return (
    <div
      className={`flex flex-col bg-white border border-stone-200 rounded-xl overflow-hidden transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : 'w-full shadow-xs'
      }`}
    >
      {/* Top RichFormat Toolbar */}
      <div className="px-3 py-2 bg-[#F7F4EE] border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {/* Headings */}
          <div className="flex items-center bg-white border border-stone-200 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => insertText('## ', '\n', '二級大標題')}
              className="p-1.5 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded"
              title="插入二級標題 (##)"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertText('### ', '\n', '三級子標題')}
              className="p-1.5 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded"
              title="插入三級標題 (###)"
            >
              <Heading3 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Inline formats */}
          <div className="flex items-center bg-white border border-stone-200 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => insertText('**', '**', '粗體文字')}
              className="p-1.5 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded"
              title="粗體 (**)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertText('*', '*', '斜體文字')}
              className="p-1.5 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded"
              title="斜體 (*)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertText('~~', '~~', '刪除文字')}
              className="p-1.5 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded"
              title="刪除線 (~~)"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertText('`', '`', '程式碼')}
              className="p-1.5 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded"
              title="行內代碼 (`)"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Block structures */}
          <div className="flex items-center bg-white border border-stone-200 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => insertText('- ', '\n', '清單項目')}
              className="p-1.5 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded"
              title="無序清單 (-)"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertText('1. ', '\n', '步驟項目')}
              className="p-1.5 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded"
              title="編號清單 (1.)"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertText('> ', '\n', '引言重點...')}
              className="p-1.5 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded"
              title="引用區塊 (>)"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertText('```typescript\n', '\n```\n', '// 程式碼區塊')}
              className="p-1.5 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded"
              title="程式碼區塊 (```)"
            >
              <FileCode className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                insertText(
                  '\n| 項目 | 說明 | 備註 |\n| --- | --- | --- |\n| 1 |  |  |\n| 2 |  |  |\n',
                )
              }
              className="p-1.5 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded"
              title="插入表格"
            >
              <Table className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Media & Embeds */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setModalType('image')}
              className="px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 inline-flex items-center gap-1 shadow-2xs"
            >
              <Image className="w-3.5 h-3.5 text-blue-600" />
              <span>插入圖檔 (Drive)</span>
            </button>

            <button
              type="button"
              onClick={() => setModalType('embed')}
              className="px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 inline-flex items-center gap-1 shadow-2xs"
            >
              <Video className="w-3.5 h-3.5 text-emerald-600" />
              <span>內嵌物件 (Drive/Meet/影片)</span>
            </button>
          </div>
        </div>

        {/* View Mode & Fullscreen Controls */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-white border border-stone-200 rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`px-2 py-1 rounded transition-colors ${
                viewMode === 'edit'
                  ? 'bg-stone-900 text-white font-medium'
                  : 'text-stone-600 hover:text-stone-950'
              }`}
            >
              純編輯
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2 py-1 rounded transition-colors inline-flex items-center gap-1 ${
                viewMode === 'split'
                  ? 'bg-stone-900 text-white font-medium'
                  : 'text-stone-600 hover:text-stone-950'
              }`}
            >
              <Split className="w-3 h-3" />
              <span>雙欄對照</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-2 py-1 rounded transition-colors inline-flex items-center gap-1 ${
                viewMode === 'preview'
                  ? 'bg-stone-900 text-white font-medium'
                  : 'text-stone-600 hover:text-stone-950'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>預覽</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="p-1.5 text-stone-600 hover:text-stone-900 bg-white border border-stone-200 rounded-lg hover:bg-stone-50"
            title={isFullscreen ? '退出全螢幕' : '全螢幕專注編輯'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Editor Body Area */}
      <div className={`grid ${viewMode === 'split' ? 'grid-cols-1 md:grid-cols-2 divide-x divide-stone-200' : 'grid-cols-1'} flex-1 min-h-[360px]`}>
        {/* Editor input column */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className="flex flex-col h-full bg-white">
            <textarea
              ref={textareaRef}
              rows={isFullscreen ? 28 : 14}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="支援 RichFormat Markdown 語法，可點選上方工具列快速套用格式、上傳圖檔至 Google Drive 或插入雲端資源..."
              className="w-full flex-1 p-4 text-sm font-mono-tabular leading-relaxed resize-y focus:outline-none focus:bg-[#FBF9F5]/30"
            />
          </div>
        )}

        {/* Live Preview column */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="flex flex-col h-full bg-[#FBF9F5] p-5 overflow-y-auto max-h-[600px]">
            <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>即時讀者閱讀渲染效果</span>
              <span className="font-mono-tabular">{charCount} 字</span>
            </div>
            <article
              className="prose prose-stone prose-sm max-w-none text-stone-800 leading-relaxed font-serif-reading"
              dangerouslySetInnerHTML={{__html: previewHtml}}
            />
          </div>
        )}
      </div>

      {/* Editor Status / Summary Bar */}
      <div className="px-4 py-2 bg-[#F7F4EE] border-t border-stone-200 flex flex-wrap items-center justify-between text-xs text-stone-500 font-mono-tabular">
        <div className="flex items-center gap-4">
          <span>{charCount} 字元</span>
          <span>約需 {readingTimeMin} 分鐘閱讀</span>
          {accessToken && (
            <span className="text-emerald-700 font-sans inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              Google Drive 上傳就緒
            </span>
          )}
        </div>
        <div className="text-[11px] text-stone-400 font-sans">
          可直接拖曳本機圖片至編輯區或點選「插入圖檔」
        </div>
      </div>

      {/* Modal: Insert Image (Google Drive Upload or URL) */}
      {modalType === 'image' && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setModalType(null)}
        >
          <div
            className="bg-white border border-stone-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-blue-600" />
                <h3 className="font-editorial text-base font-semibold text-stone-950">
                  插入文章圖檔
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 leading-relaxed">
                {uploadError}
              </div>
            )}

            {uploadProgressMsg && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span>{uploadProgressMsg}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Option 1: Direct Google Drive Upload */}
              <div className="p-4 bg-[#F7F4EE] border border-stone-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>上傳電腦圖檔至 Google Drive</span>
                  </span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium">
                    推薦
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  圖檔將直接儲存至您的 Google 雲端硬碟，並自動轉換為直連公開快取網址，前台訪客讀取零延遲。
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingDrive}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-800 hover:bg-stone-50 hover:border-stone-400 transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingDrive ? '上傳處理中...' : '選擇本機圖片上傳至 Google Drive'}</span>
                </button>
              </div>

              {/* Option 2: Paste external image URL */}
              <div className="space-y-2 pt-1 border-t border-stone-100">
                <span className="text-xs font-semibold text-stone-700 block">
                  或輸入外部圖片網址 (URL)
                </span>
                <input
                  type="url"
                  value={imgUrl}
                  onChange={(e) => setImgUrl(e.target.value)}
                  placeholder="https://example.com/math-boardgame.jpg"
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                />
                <input
                  type="text"
                  value={imgAlt}
                  onChange={(e) => setImgAlt(e.target.value)}
                  placeholder="圖說描述文字（選填，例如：數學步道實作觀察）"
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                />
              </div>

              {/* Helper checkbox */}
              {onSetCoverImage && (
                <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={setAsCoverToo}
                    onChange={(e) => setSetAsCoverToo(e.target.checked)}
                    className="rounded border-stone-300 text-[#1E3A8A]"
                  />
                  <span>同時將此圖設為文章封面圖 (Cover Image)</span>
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-3.5 py-1.5 text-xs text-stone-600 hover:text-stone-900"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleInsertImageUrl}
                disabled={!imgUrl.trim()}
                className="px-4 py-1.5 text-xs font-medium text-white bg-[#1E3A8A] rounded-lg hover:bg-[#172554] disabled:bg-stone-300 transition-colors"
              >
                插入圖片
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Insert Embed Object */}
      {modalType === 'embed' && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setModalType(null)}
        >
          <div
            className="bg-white border border-stone-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-emerald-600" />
                <h3 className="font-editorial text-base font-semibold text-stone-950">
                  內嵌雲端資源或影片物件
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Embed Category Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-[#F7F4EE] rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setEmbedType('drive')}
                className={`flex-1 py-1.5 rounded text-center transition-colors ${
                  embedType === 'drive'
                    ? 'bg-white text-stone-950 font-semibold shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                雲端文件
              </button>
              <button
                type="button"
                onClick={() => setEmbedType('youtube')}
                className={`flex-1 py-1.5 rounded text-center transition-colors ${
                  embedType === 'youtube'
                    ? 'bg-white text-stone-950 font-semibold shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                YouTube 影片
              </button>
              <button
                type="button"
                onClick={() => setEmbedType('forms')}
                className={`flex-1 py-1.5 rounded text-center transition-colors ${
                  embedType === 'forms'
                    ? 'bg-white text-stone-950 font-semibold shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Forms 表單
              </button>
              <button
                type="button"
                onClick={() => setEmbedType('meet')}
                className={`flex-1 py-1.5 rounded text-center transition-colors ${
                  embedType === 'meet'
                    ? 'bg-white text-stone-950 font-semibold shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Meet 會議
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  {embedType === 'youtube'
                    ? 'YouTube 影片網址'
                    : embedType === 'drive'
                    ? 'Google Drive 檔案共用網址 (PDF/Doc)'
                    : embedType === 'forms'
                    ? 'Google Forms 表單連結'
                    : 'Google Meet 會議代碼或網址'}
                </label>
                <input
                  type="url"
                  value={embedUrl}
                  onChange={(e) => setEmbedUrl(e.target.value)}
                  placeholder={
                    embedType === 'youtube'
                      ? 'https://www.youtube.com/watch?v=...'
                      : embedType === 'drive'
                      ? 'https://drive.google.com/file/d/.../view'
                      : embedType === 'forms'
                      ? 'https://docs.google.com/forms/d/...'
                      : 'https://meet.google.com/abc-defg-hij'
                  }
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  物件名稱或說明標籤
                </label>
                <input
                  type="text"
                  value={embedLabel}
                  onChange={(e) => setEmbedLabel(e.target.value)}
                  placeholder="例如：113 年期末教學檢討簡報 PDF"
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-3.5 py-1.5 text-xs text-stone-600 hover:text-stone-900"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleInsertEmbed}
                disabled={!embedUrl.trim()}
                className="px-4 py-1.5 text-xs font-medium text-white bg-[#1E3A8A] rounded-lg hover:bg-[#172554] disabled:bg-stone-300 transition-colors"
              >
                插入物件
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
