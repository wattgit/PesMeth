import {JournalPost} from '../types/journal';

export interface RssImportResult {
  feedTitle: string;
  totalReported: number;
  posts: JournalPost[];
}

function stripHtmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHtmlForJournal(rawHtml: string): string {
  if (!rawHtml) return '';
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');

  // Remove dangerous or noisy tags
  doc.querySelectorAll('script, style, noscript').forEach((el) => el.remove());

  // Clean inline dimensions/styles on images & tables so they stay responsive
  doc.querySelectorAll('img').forEach((img) => {
    img.removeAttribute('width');
    img.removeAttribute('height');
    img.removeAttribute('style');
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.setAttribute('loading', 'lazy');
  });

  doc.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('http')) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  });

  doc.querySelectorAll('[style]').forEach((el) => {
    el.removeAttribute('style');
  });

  let cleaned = doc.body.innerHTML.trim();
  // Guard Google Sheets 50,000-character per-cell limit
  if (cleaned.length > 45000) {
    cleaned = cleaned.slice(0, 45000) + '\n\n<p>（文章內容過長，其餘內容請參閱原始連結）</p>';
  }
  return cleaned;
}

function inferAcademicYearFromDate(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})/);
  if (!match) return '113 學年度';
  const year = Number(match[1]);
  const month = Number(match[2]);
  // Taiwan academic year starts in August (month >= 8 -> year - 1911; else year - 1912)
  const rocYear = month >= 8 ? year - 1911 : year - 1912;
  return `${rocYear} 學年度`;
}

function splitAcademicYearAndCategory(
  terms: string[],
  publishedAt: string,
): {academicYear: string; category: string} {
  let academicYear = '';
  const topicCategories: string[] = [];

  for (const raw of terms) {
    const term = raw.trim();
    if (!term) continue;
    const yearMatch = term.match(/^(\d{2,3})\s*學年度$/);
    if (yearMatch) {
      academicYear = `${yearMatch[1]} 學年度`;
    } else {
      topicCategories.push(term);
    }
  }

  return {
    academicYear: academicYear || inferAcademicYearFromDate(publishedAt),
    category: topicCategories[0] || '社群專欄',
  };
}

function extractFirstImageUrl(
  rawHtml: string,
  thumbnailUrl?: string,
): string | undefined {
  if (rawHtml) {
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    const firstImg = doc.querySelector('img');
    const src = firstImg?.getAttribute('src')?.trim();
    if (src && src.startsWith('http')) {
      return src;
    }
  }
  if (thumbnailUrl && thumbnailUrl.startsWith('http')) {
    return thumbnailUrl.replace(/\/s\d+(-c)?\//, '/w800/');
  }
  return undefined;
}

function extractEmbedResource(
  rawHtml: string,
  fallbackUrl?: string,
): {embedUrl?: string; embedLabel?: string} {
  if (rawHtml) {
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    const iframeSrc = doc.querySelector('iframe')?.getAttribute('src')?.trim();
    if (iframeSrc && iframeSrc.startsWith('http')) {
      return {
        embedUrl: iframeSrc,
        embedLabel: '文章內嵌雲端檢視資源',
      };
    }

    const links = Array.from(doc.querySelectorAll('a'));
    for (const a of links) {
      const href = a.getAttribute('href')?.trim() || '';
      if (
        href.includes('drive.google.com') ||
        href.includes('docs.google.com') ||
        href.includes('meet.google.com') ||
        href.includes('forms.gle')
      ) {
        const text = a.textContent?.trim();
        return {
          embedUrl: href,
          embedLabel: text && text.length > 2 ? text : 'Google 雲端教學附件',
        };
      }
    }
  }

  if (fallbackUrl) {
    return {
      embedUrl: fallbackUrl,
      embedLabel: 'Blogger 原始文章連結',
    };
  }
  return {};
}

function parseBloggerFeedJson(data: any): RssImportResult {
  const feed = data?.feed;
  if (!feed) {
    throw new Error('找不到 Blogger Feed 資料結構，請確認網址正確。');
  }

  const feedTitle: string =
    feed.title?.$t?.trim() || 'Google Blogger 匯入文章';
  const totalReported = Number(feed.openSearch$totalResults?.$t || 0);
  const entries: any[] = Array.isArray(feed.entry) ? feed.entry : [];

  const posts: JournalPost[] = entries.map((entry, idx) => {
    const rawId: string = entry.id?.$t || `${Date.now()}-${idx}`;
    const postIdMatch = rawId.match(/post-(\d+)/);
    const slug = postIdMatch
      ? `blogger-${postIdMatch[1]}`
      : `rss-${idx + 1}-${Date.now().toString(36)}`;

    const title: string = entry.title?.$t?.trim() || `未命名文章 #${idx + 1}`;
    const publishedRaw: string =
      entry.published?.$t || entry.updated?.$t || new Date().toISOString();
    const publishedAt = publishedRaw.slice(0, 10);

    const terms: string[] = Array.isArray(entry.category)
      ? entry.category.map((c: any) => String(c.term || ''))
      : [];
    const {academicYear, category} = splitAcademicYearAndCategory(
      terms,
      publishedAt,
    );

    const rawAuthor: string = entry.author?.[0]?.name?.$t?.trim() || '';
    const author =
      !rawAuthor || rawAuthor.toLowerCase() === 'unknown'
        ? feedTitle
        : rawAuthor;

    const rawHtml: string =
      entry.content?.$t || entry.summary?.$t || '';
    const cleanedHtml = cleanHtmlForJournal(rawHtml);
    const plainText = stripHtmlToText(rawHtml);
    const summary =
      plainText.length > 130 ? `${plainText.slice(0, 130)}...` : plainText;

    const alternateLink = Array.isArray(entry.link)
      ? entry.link.find((l: any) => l.rel === 'alternate')?.href
      : undefined;

    const coverImageUrl = extractFirstImageUrl(
      rawHtml,
      entry.media$thumbnail?.url,
    );
    const {embedUrl, embedLabel} = extractEmbedResource(rawHtml, alternateLink);

    return {
      slug,
      title,
      summary: summary || title,
      content: cleanedHtml || plainText || title,
      category,
      academicYear,
      publishedAt,
      author,
      isFeatured: false,
      status: 'Published',
      coverImageUrl,
      embedUrl,
      embedLabel,
    };
  });

  return {
    feedTitle,
    totalReported: totalReported || posts.length,
    posts,
  };
}

function buildBloggerJsonpUrl(inputUrl: string): string {
  const url = new URL(inputUrl.trim());
  // Normalize root blog URL (e.g. https://ximen-math.blogspot.com/) to feed endpoint
  if (!url.pathname.includes('/feeds/')) {
    url.pathname = '/feeds/posts/default';
  }
  url.searchParams.set('alt', 'json-in-script');
  if (!url.searchParams.has('max-results')) {
    url.searchParams.set('max-results', '500');
  }
  return url.toString();
}

function isBloggerFeedUrl(inputUrl: string): boolean {
  try {
    const url = new URL(inputUrl.trim());
    return (
      url.hostname.includes('blogspot.') ||
      url.hostname.includes('blogger.com') ||
      url.pathname.includes('/feeds/posts/')
    );
  } catch {
    return false;
  }
}

function fetchBloggerViaJsonp(inputUrl: string): Promise<RssImportResult> {
  return new Promise((resolve, reject) => {
    const callbackName = `__pesmathBloggerCb_${Date.now()}_${Math.floor(
      Math.random() * 10000,
    )}`;
    const jsonpUrl = new URL(buildBloggerJsonpUrl(inputUrl));
    jsonpUrl.searchParams.set('callback', callbackName);

    const script = document.createElement('script');
    script.src = jsonpUrl.toString();
    script.async = true;

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('讀取 Blogger RSS Feed 逾時，請檢查網址是否正確或可公開存取。'));
    }, 15000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      delete (window as any)[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    (window as any)[callbackName] = (payload: any) => {
      cleanup();
      try {
        resolve(parseBloggerFeedJson(payload));
      } catch (err) {
        reject(err);
      }
    };

    script.onerror = () => {
      cleanup();
      reject(
        new Error(
          '無法載入 Blogger Feed，請確認網址格式（例如 https://ximen-math.blogspot.com/feeds/posts/default?max-results=500）。',
        ),
      );
    };

    document.body.appendChild(script);
  });
}

export function parseRssOrAtomXml(xmlText: string): RssImportResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('XML 格式無法解析，請確認內容為有效的 RSS 或 Atom Feed。');
  }

  // Detect Atom (<feed><entry>) vs RSS 2.0 (<rss><channel><item>)
  const isAtom = Boolean(doc.querySelector('feed > entry'));
  if (isAtom) {
    const feedTitle =
      doc.querySelector('feed > title')?.textContent?.trim() || 'Atom Feed 匯入';
    const entries = Array.from(doc.querySelectorAll('feed > entry'));
    const posts: JournalPost[] = entries.map((entry, idx) => {
      const rawId = entry.querySelector('id')?.textContent?.trim() || `${idx}`;
      const postIdMatch = rawId.match(/post-(\d+)/);
      const slug = postIdMatch
        ? `blogger-${postIdMatch[1]}`
        : `atom-${idx + 1}-${Date.now().toString(36)}`;
      const title =
        entry.querySelector('title')?.textContent?.trim() ||
        `未命名文章 #${idx + 1}`;
      const publishedRaw =
        entry.querySelector('published')?.textContent?.trim() ||
        entry.querySelector('updated')?.textContent?.trim() ||
        new Date().toISOString();
      const publishedAt = publishedRaw.slice(0, 10);
      const terms = Array.from(entry.querySelectorAll('category'))
        .map((c) => c.getAttribute('term') || c.textContent || '')
        .filter(Boolean);
      const {academicYear, category} = splitAcademicYearAndCategory(
        terms,
        publishedAt,
      );
      const rawAuthor =
        entry.querySelector('author > name')?.textContent?.trim() || '';
      const author =
        !rawAuthor || rawAuthor.toLowerCase() === 'unknown'
          ? feedTitle
          : rawAuthor;
      const rawHtml =
        entry.querySelector('content')?.textContent ||
        entry.querySelector('summary')?.textContent ||
        '';
      const cleanedHtml = cleanHtmlForJournal(rawHtml);
      const plainText = stripHtmlToText(rawHtml);
      const summary =
        plainText.length > 130 ? `${plainText.slice(0, 130)}...` : plainText;
      const altHref = entry
        .querySelector('link[rel="alternate"]')
        ?.getAttribute('href') || undefined;
      const coverImageUrl = extractFirstImageUrl(rawHtml);
      const {embedUrl, embedLabel} = extractEmbedResource(rawHtml, altHref);

      return {
        slug,
        title,
        summary: summary || title,
        content: cleanedHtml || plainText || title,
        category,
        academicYear,
        publishedAt,
        author,
        isFeatured: false,
        status: 'Published',
        coverImageUrl,
        embedUrl,
        embedLabel,
      };
    });
    return {feedTitle, totalReported: posts.length, posts};
  }

  // RSS 2.0
  const feedTitle =
    doc.querySelector('channel > title')?.textContent?.trim() || 'RSS Feed 匯入';
  const items = Array.from(doc.querySelectorAll('channel > item'));
  const posts: JournalPost[] = items.map((item, idx) => {
    const guid = item.querySelector('guid')?.textContent?.trim() || '';
    const link = item.querySelector('link')?.textContent?.trim() || undefined;
    const title =
      item.querySelector('title')?.textContent?.trim() || `未命名文章 #${idx + 1}`;
    const pubDateRaw = item.querySelector('pubDate')?.textContent?.trim();
    const parsedDate = pubDateRaw ? new Date(pubDateRaw) : new Date();
    const publishedAt = !isNaN(parsedDate.getTime())
      ? parsedDate.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const terms = Array.from(item.querySelectorAll('category'))
      .map((c) => c.textContent || '')
      .filter(Boolean);
    const {academicYear, category} = splitAcademicYearAndCategory(
      terms,
      publishedAt,
    );

    const rawHtml =
      item.getElementsByTagName('content:encoded')[0]?.textContent ||
      item.querySelector('description')?.textContent ||
      '';
    const cleanedHtml = cleanHtmlForJournal(rawHtml);
    const plainText = stripHtmlToText(rawHtml);
    const summary =
      plainText.length > 130 ? `${plainText.slice(0, 130)}...` : plainText;
    const coverImageUrl = extractFirstImageUrl(rawHtml);
    const {embedUrl, embedLabel} = extractEmbedResource(rawHtml, link);

    const slugBase = guid.match(/post-(\d+)/)?.[1] || `${idx + 1}-${Date.now().toString(36)}`;
    return {
      slug: `rss-${slugBase}`,
      title,
      summary: summary || title,
      content: cleanedHtml || plainText || title,
      category,
      academicYear,
      publishedAt,
      author: feedTitle,
      isFeatured: false,
      status: 'Published',
      coverImageUrl,
      embedUrl,
      embedLabel,
    };
  });

  return {feedTitle, totalReported: posts.length, posts};
}

export async function fetchRssFeedPosts(
  feedUrl: string,
): Promise<RssImportResult> {
  const trimmed = feedUrl.trim();
  if (!trimmed) {
    throw new Error('請輸入 RSS / Blogger Feed 網址。');
  }

  if (isBloggerFeedUrl(trimmed)) {
    return await fetchBloggerViaJsonp(trimmed);
  }

  // Generic RSS/Atom XML fetch (for CORS-enabled feeds)
  try {
    const res = await fetch(trimmed);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const xmlText = await res.text();
    return parseRssOrAtomXml(xmlText);
  } catch (err: any) {
    throw new Error(
      `無法直接抓取此 RSS 網址（${err?.message || '跨來源 CORS 限制'}）。若是 Blogger 部落格請使用 *.blogspot.com/feeds/posts/default 網址，或改用下方「貼上 XML 原始碼」方式匯入。`,
    );
  }
}
