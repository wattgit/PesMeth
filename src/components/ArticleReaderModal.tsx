import React, {useMemo, useState} from 'react';
import {marked} from 'marked';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  X,
} from 'lucide-react';
import {JournalPost} from '../types/journal';
import {inferEmbedProvider} from '../services/sheetsDb';

interface ArticleReaderModalProps {
  post: JournalPost | null;
  allPosts: JournalPost[];
  canEdit: boolean;
  onClose: () => void;
  onSelectPost: (post: JournalPost) => void;
  onEditPost: (post: JournalPost) => void;
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

function toEmbeddableUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('drive.google.com') && parsed.pathname.includes('/file/d/')) {
      return url.replace(/\/view.*$/, '/preview');
    }
    if (parsed.hostname.includes('docs.google.com') && parsed.pathname.includes('/forms/')) {
      if (!url.includes('embedded=true')) {
        return url.includes('?') ? `${url}&embedded=true` : `${url}?embedded=true`;
      }
      return url;
    }
    if (parsed.pathname.endsWith('/preview')) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

export const ArticleReaderModal: React.FC<ArticleReaderModalProps> = ({
  post,
  allPosts,
  canEdit,
  onClose,
  onSelectPost,
  onEditPost,
}) => {
  const [copied, setCopied] = useState(false);
  const [showInlineEmbed, setShowInlineEmbed] = useState(false);

  const renderedHtml = useMemo(() => {
    if (!post) return '';
    const raw = marked.parse(post.content || post.summary || '', {
      async: false,
      gfm: true,
      breaks: true,
    }) as string;
    return sanitizeHtml(raw);
  }, [post]);

  if (!post) return null;

  const currentIdx = allPosts.findIndex((p) => p.slug === post.slug);
  const prevPost = currentIdx > 0 ? allPosts[currentIdx - 1] : null;
  const nextPost =
    currentIdx >= 0 && currentIdx < allPosts.length - 1
      ? allPosts[currentIdx + 1]
      : null;

  const embedMeta = post.embedUrl ? inferEmbedProvider(post.embedUrl) : null;
  const inlineEmbedUrl = post.embedUrl ? toEmbeddableUrl(post.embedUrl) : null;

  const handleCopyPermalink = async () => {
    const url = new URL(window.location.href);
    url.hash = `post=${encodeURIComponent(post.slug)}`;
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto bg-stone-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-article-title"
    >
      <div className="min-h-full px-4 py-6 sm:py-10 flex justify-center">
        <article className="w-full max-w-4xl bg-[#FBF9F5] border border-stone-200 rounded-xl shadow-2xl overflow-hidden flex flex-col">
          {/* Top Reader Utility Bar */}
          <div className="px-6 sm:px-10 py-4 bg-white border-b border-stone-200 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 text-sm font-medium text-stone-700 hover:text-stone-950 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>返回期刊目錄</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyPermalink}
                className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    <span>已複製連結</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>複製分享連結</span>
                  </>
                )}
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => onEditPost(post)}
                  className="px-3 py-1.5 text-xs font-medium text-[#1E3A8A] bg-white border border-[#1E3A8A]/30 rounded-lg hover:bg-[#1E3A8A]/5 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>編輯文章</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
                aria-label="關閉文章"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Article Header */}
          <header className="px-6 sm:px-12 pt-8 sm:pt-12 pb-8 bg-white border-b border-stone-200">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-500 mb-4">
              <span className="font-mono-tabular font-medium text-[#1E3A8A]">
                {post.academicYear}
              </span>
              <span aria-hidden="true">·</span>
              <span>{post.category}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">{post.publishedAt}</span>
              {post.isFeatured && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-stone-800">精選專題</span>
                </>
              )}
              {post.status === 'Draft' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-amber-800">草稿預覽</span>
                </>
              )}
            </div>

            <h1
              id="reader-article-title"
              className="font-editorial text-2xl sm:text-4xl font-semibold text-stone-950 leading-tight text-balance"
            >
              {post.title}
            </h1>

            {post.summary && (
              <p className="mt-4 text-base sm:text-lg text-stone-600 leading-relaxed max-w-2xl">
                {post.summary}
              </p>
            )}

            <dl className="mt-6 pt-6 border-t border-stone-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <dt className="text-stone-400 mb-0.5">撰稿與彙整</dt>
                <dd className="font-medium text-stone-800">{post.author}</dd>
              </div>
              <div>
                <dt className="text-stone-400 mb-0.5">所屬學年度</dt>
                <dd className="font-mono-tabular font-medium text-stone-800">
                  {post.academicYear}
                </dd>
              </div>
              <div>
                <dt className="text-stone-400 mb-0.5">期刊分類</dt>
                <dd className="font-medium text-stone-800">{post.category}</dd>
              </div>
              <div>
                <dt className="text-stone-400 mb-0.5">索引代號</dt>
                <dd className="font-mono-tabular text-stone-700 truncate">
                  {post.slug}
                </dd>
              </div>
            </dl>
          </header>

          {/* Optional Cover Image */}
          {post.coverImageUrl && (
            <figure className="bg-[#F7F4EE] border-b border-stone-200 px-6 sm:px-12 py-6">
              <div className="aspect-[16/9] w-full overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                <img
                  src={post.coverImageUrl}
                  alt={post.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <figcaption className="mt-2.5 text-xs text-stone-500 font-editorial italic">
                圖說 — {post.title}
              </figcaption>
            </figure>
          )}

          {/* Main Markdown Reading Body */}
          <div className="px-6 sm:px-12 py-8 sm:py-10 bg-white">
            <div
              className="journal-prose max-w-2xl mx-auto"
              dangerouslySetInnerHTML={{__html: renderedHtml}}
            />

            {/* Embedded Google Drive / Meet / Forms Attachment */}
            {post.embedUrl && embedMeta && (
              <section className="max-w-2xl mx-auto mt-10 pt-8 border-t border-stone-200">
                <h2 className="font-editorial text-lg font-semibold text-stone-900 mb-4">
                  相關雲端附件與教學資源
                </h2>
                <div className="bg-[#F7F4EE] border border-stone-200 rounded-xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-white border border-stone-200 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-[#1E3A8A]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-mono-tabular text-stone-500">
                          {embedMeta.provider}
                          {embedMeta.domain ? ` · ${embedMeta.domain}` : ''}
                        </div>
                        <div className="text-sm font-semibold text-stone-900 mt-0.5 break-words">
                          {post.embedLabel || post.title}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {inlineEmbedUrl && (
                        <button
                          type="button"
                          onClick={() => setShowInlineEmbed((v) => !v)}
                          className="px-3.5 py-2 text-xs font-medium text-stone-800 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{showInlineEmbed ? '收合預覽' : '內嵌預覽'}</span>
                        </button>
                      )}
                      <a
                        href={post.embedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-lg hover:bg-[#172554] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>開啟原始連結</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {showInlineEmbed && inlineEmbedUrl && (
                    <div className="pt-3 border-t border-stone-200">
                      <iframe
                        src={inlineEmbedUrl}
                        title={post.embedLabel || post.title}
                        className="w-full h-[460px] rounded-lg border border-stone-200 bg-white"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Footer Navigation Between Articles */}
          <footer className="px-6 sm:px-12 py-6 bg-[#F7F4EE] border-t border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              {prevPost && (
                <button
                  type="button"
                  onClick={() => {
                    setShowInlineEmbed(false);
                    onSelectPost(prevPost);
                  }}
                  className="text-left group w-full p-3 rounded-lg bg-white border border-stone-200 hover:border-stone-300 transition-colors"
                >
                  <div className="text-xs text-stone-500 flex items-center gap-1 mb-1">
                    <ArrowLeft className="w-3 h-3" />
                    <span>上一篇文章</span>
                  </div>
                  <div className="text-sm font-medium text-stone-900 group-hover:text-[#1E3A8A] line-clamp-1">
                    {prevPost.title}
                  </div>
                </button>
              )}
            </div>
            <div>
              {nextPost && (
                <button
                  type="button"
                  onClick={() => {
                    setShowInlineEmbed(false);
                    onSelectPost(nextPost);
                  }}
                  className="text-right group w-full p-3 rounded-lg bg-white border border-stone-200 hover:border-stone-300 transition-colors"
                >
                  <div className="text-xs text-stone-500 flex items-center justify-end gap-1 mb-1">
                    <span>下一篇文章</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                  <div className="text-sm font-medium text-stone-900 group-hover:text-[#1E3A8A] line-clamp-1">
                    {nextPost.title}
                  </div>
                </button>
              )}
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
};
