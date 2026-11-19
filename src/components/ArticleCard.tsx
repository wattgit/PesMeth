import React, {useState} from 'react';
import {ArrowUpRight, BookOpen, ExternalLink, FileText, Video, Table2} from 'lucide-react';
import {JournalPost} from '../types/journal';
import {inferEmbedProvider} from '../services/sheetsDb';

interface ArticleCardProps {
  post: JournalPost;
  onSelect: (post: JournalPost) => void;
}

function estimateReadMinutes(content: string): number {
  const chars = content.replace(/\s+/g, '').length;
  return Math.max(1, Math.round(chars / 320));
}

export const ArticleCard: React.FC<ArticleCardProps> = ({post, onSelect}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const embedMeta = post.embedUrl ? inferEmbedProvider(post.embedUrl) : null;
  const readMins = estimateReadMinutes(post.content || post.summary);
  const hasCover = Boolean(post.coverImageUrl && !imgFailed);

  const renderEmbedIcon = () => {
    if (!embedMeta) return <FileText className="w-4 h-4 text-[#1E3A8A]" />;
    if (embedMeta.provider === 'Google Meet') {
      return <Video className="w-4 h-4 text-[#1E3A8A]" />;
    }
    if (embedMeta.provider === 'Google Sheets') {
      return <Table2 className="w-4 h-4 text-[#1E3A8A]" />;
    }
    return <FileText className="w-4 h-4 text-[#1E3A8A]" />;
  };

  return (
    <article className="group bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:border-stone-300 hover:shadow-md">
      <button
        type="button"
        onClick={() => onSelect(post)}
        className="text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E3A8A]"
      >
        {hasCover ? (
          <div className="aspect-[16/9] w-full bg-[#EBE6DF] overflow-hidden border-b border-stone-200">
            <img
              src={post.coverImageUrl}
              alt={post.title}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
        ) : post.embedUrl && embedMeta ? (
          <div className="aspect-[16/9] w-full bg-[#F7F4EE] border-b border-stone-200 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span className="font-mono-tabular uppercase tracking-wider">
                {embedMeta.provider}
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#1E3A8A] transition-colors" />
            </div>
            <div className="bg-white border border-stone-200 rounded-lg px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-[#FBF9F5] border border-stone-200 flex items-center justify-center shrink-0">
                {renderEmbedIcon()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-stone-900 truncate">
                  {post.embedLabel || post.title}
                </div>
                <div className="text-xs text-stone-500 truncate mt-0.5">
                  {embedMeta.domain || '雲端嵌入文件'}
                </div>
              </div>
            </div>
            <div className="text-xs font-medium text-[#1E3A8A] flex items-center gap-1">
              <span>點擊閱讀全文並檢視附件</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
        ) : (
          <div className="aspect-[16/9] w-full bg-[#F7F4EE] border-b border-stone-200 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-stone-500 font-mono-tabular">
              <span>{post.academicYear}</span>
              <BookOpen className="w-4 h-4 text-stone-400" />
            </div>
            <p className="font-editorial text-lg font-medium text-stone-800 line-clamp-2 leading-snug">
              {post.title}
            </p>
          </div>
        )}
      </button>

      <div className="p-6 flex-1 flex flex-col justify-between gap-5">
        <div className="space-y-3">
          {/* Unboxed typographic metadata with subtle middot separators */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
            {post.isFeatured && (
              <>
                <span className="font-semibold text-[#1E3A8A]">精選置頂</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            {post.status === 'Draft' && (
              <>
                <span className="font-semibold text-amber-800">草稿預覽</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span className="font-mono-tabular">{post.academicYear}</span>
            <span aria-hidden="true">·</span>
            <span>{post.category}</span>
            <span aria-hidden="true">·</span>
            <span>{readMins} 分鐘閱讀</span>
          </div>

          <h3 className="font-editorial text-xl font-semibold text-stone-900 leading-snug text-balance">
            <button
              type="button"
              onClick={() => onSelect(post)}
              className="text-left hover:text-[#1E3A8A] transition-colors focus-visible:outline-none focus-visible:underline"
            >
              {post.title}
            </button>
          </h3>

          <p className="text-sm text-stone-600 leading-relaxed line-clamp-3">
            {post.summary || '點擊「閱讀全文」檢視完整教案與社群會議紀錄。'}
          </p>
        </div>

        <div className="pt-4 border-t border-stone-100 flex items-center justify-between gap-4 text-xs">
          <div className="text-stone-500 truncate">
            <span>{post.author}</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="font-mono-tabular">{post.publishedAt}</span>
          </div>
          <button
            type="button"
            onClick={() => onSelect(post)}
            className="font-medium text-[#1E3A8A] hover:text-[#172554] inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <span>閱讀全文</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};
