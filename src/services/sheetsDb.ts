import {JournalPost, PostStatus, SpreadsheetMeta} from '../types/journal';

export const SHEET_HEADERS = [
  'Slug',
  'Title',
  'Summary',
  'Content',
  'Category',
  'AcademicYear',
  'PublishedAt',
  'Author',
  'IsFeatured',
  'Status',
  'CoverImageUrl',
  'EmbedUrl',
  'EmbedLabel',
] as const;

/**
 * Extracts a Google Spreadsheet ID from either a raw ID or a full Google Sheets URL.
 */
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

function escapeA1SheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

function postToRow(post: JournalPost): string[] {
  return [
    post.slug,
    post.title,
    post.summary,
    post.content,
    post.category,
    post.academicYear,
    post.publishedAt,
    post.author,
    post.isFeatured ? 'TRUE' : 'FALSE',
    post.status,
    post.coverImageUrl || '',
    post.embedUrl || '',
    post.embedLabel || '',
  ];
}

function normalizeHeaderKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function parseBool(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  const s = String(val ?? '')
    .trim()
    .toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === '是';
}

function parseStatus(val: unknown): PostStatus {
  const s = String(val ?? '')
    .trim()
    .toLowerCase();
  return s === 'draft' || s === '草稿' ? 'Draft' : 'Published';
}

function rowToPost(
  row: unknown[],
  headerMap: Record<string, number>,
  rowIndex: number,
): JournalPost | null {
  const getCell = (keys: string[]): string => {
    for (const k of keys) {
      const idx = headerMap[k];
      if (idx !== undefined && row[idx] !== undefined && row[idx] !== null) {
        return String(row[idx]).trim();
      }
    }
    return '';
  };

  const title = getCell(['title', '標題', '文章標題']);
  if (!title) return null;

  const rawSlug = getCell(['slug', '代碼', 'id']);
  const slug =
    rawSlug ||
    `post-${rowIndex}-${title
      .slice(0, 12)
      .replace(/\s+/g, '-')
      .toLowerCase()}`;

  const rawCover = getCell(['coverimageurl', '封面圖片', 'cover']);
  const coverImageUrl = rawCover
    ? rawCover.startsWith('/src/assets/')
      ? `.${rawCover}`
      : rawCover
    : undefined;

  return {
    slug,
    title,
    summary: getCell(['summary', '摘要', '簡介']),
    content: getCell(['content', '內文', '本文', 'markdown']),
    category: getCell(['category', '分類', '類別']) || '領域會議',
    academicYear: getCell(['academicyear', '學年度', '年度']) || '113 學年度',
    publishedAt: getCell(['publishedat', '發布日期', '日期']) || '2025-01-01',
    author: getCell(['author', '作者', '發布者']) || '數學領域社群',
    isFeatured: parseBool(getCell(['isfeatured', '精選', '置頂'])),
    status: parseStatus(getCell(['status', '狀態'])),
    coverImageUrl,
    embedUrl: getCell(['embedurl', '嵌入連結', '資源連結']) || undefined,
    embedLabel: getCell(['embedlabel', '嵌入標題', '資源說明']) || undefined,
    rowIndex,
  };
}

function buildHeaderMap(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((cell, idx) => {
    const norm = normalizeHeaderKey(String(cell ?? ''));
    if (norm) map[norm] = idx;
  });
  return map;
}

/**
 * Fetches spreadsheet metadata (title and actual tab names) via Google Sheets API v4.
 * Never assumes the first tab is named 'Sheet1'.
 */
export async function fetchSpreadsheetMeta(
  spreadsheetId: string,
  accessToken: string,
): Promise<SpreadsheetMeta> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId,
    )}?fields=spreadsheetId,properties.title,sheets.properties(sheetId,title)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message || `讀取試算表結構失敗 (${res.status})`,
    );
  }

  const data = await res.json();
  const tabs = (data.sheets || []).map((s: any) => ({
    sheetId: s.properties.sheetId as number,
    title: s.properties.title as string,
  }));

  if (tabs.length === 0) {
    throw new Error('試算表中沒有任何工作表分頁。');
  }

  const preferred =
    tabs.find((t: {title: string}) => t.title.toLowerCase() === 'posts') ||
    tabs[0];

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || '未命名試算表',
    tabs,
    activeTab: preferred.title,
  };
}

/**
 * Fetches all journal posts from a connected Google Sheet via Sheets API v4.
 */
export async function fetchPostsFromSheetsApi(
  spreadsheetId: string,
  tabName: string,
  accessToken: string,
): Promise<JournalPost[]> {
  const range = encodeURIComponent(`${escapeA1SheetName(tabName)}!A1:M1000`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId,
    )}/values/${range}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message || `無法讀取工作表資料 (${res.status})`,
    );
  }

  const data = await res.json();
  const values: unknown[][] = data.values || [];
  if (values.length < 2) {
    return [];
  }

  const headerMap = buildHeaderMap(values[0]);
  const posts: JournalPost[] = [];
  for (let i = 1; i < values.length; i++) {
    const parsed = rowToPost(values[i], headerMap, i + 1);
    if (parsed) posts.push(parsed);
  }
  return posts;
}

/**
 * Creates a brand-new Google Sheet database and seeds it with starter journal posts.
 */
export async function createAndSeedJournalSheet(
  accessToken: string,
  seedPosts: JournalPost[],
  title = 'PesMath 數學教學社群資料庫',
): Promise<{meta: SpreadsheetMeta; posts: JournalPost[]}> {
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {title},
      sheets: [
        {
          properties: {
            title: 'Posts',
            gridProperties: {frozenRowCount: 1},
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message || `建立 Google Sheet 失敗 (${createRes.status})`,
    );
  }

  const created = await createRes.json();
  const spreadsheetId: string = created.spreadsheetId;
  const tabId: number = created.sheets?.[0]?.properties?.sheetId ?? 0;

  // Strip bundled local data-URL/asset hashes for clean portable spreadsheet URLs if needed
  const rows = [
    [...SHEET_HEADERS],
    ...seedPosts.map((p) =>
      postToRow({
        ...p,
        coverImageUrl:
          p.coverImageUrl && p.coverImageUrl.startsWith('data:')
            ? ''
            : p.coverImageUrl,
      }),
    ),
  ];

  const writeRange = encodeURIComponent(`'Posts'!A1:M${rows.length}`);
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId,
    )}/values/${writeRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({values: rows}),
    },
  );

  if (!writeRes.ok) {
    const errBody = await writeRes.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message || `寫入示範文章資料失敗 (${writeRes.status})`,
    );
  }

  const meta: SpreadsheetMeta = {
    spreadsheetId,
    title,
    tabs: [{sheetId: tabId, title: 'Posts'}],
    activeTab: 'Posts',
  };

  const posts = await fetchPostsFromSheetsApi(
    spreadsheetId,
    'Posts',
    accessToken,
  );
  return {meta, posts};
}

/**
 * Appends a new post row to the connected Google Sheet.
 */
export async function appendPostToSheet(
  spreadsheetId: string,
  tabName: string,
  post: JournalPost,
  accessToken: string,
): Promise<void> {
  const range = encodeURIComponent(`${escapeA1SheetName(tabName)}!A:M`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId,
    )}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [postToRow(post)],
      }),
    },
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message || `新增文章至 Google Sheet 失敗 (${res.status})`,
    );
  }
}

/**
 * Updates an existing post row (1-based rowIndex) in the connected Google Sheet.
 */
export async function updatePostInSheet(
  spreadsheetId: string,
  tabName: string,
  rowIndex: number,
  post: JournalPost,
  accessToken: string,
): Promise<void> {
  const range = encodeURIComponent(
    `${escapeA1SheetName(tabName)}!A${rowIndex}:M${rowIndex}`,
  );
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId,
    )}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [postToRow(post)],
      }),
    },
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message || `更新 Google Sheet 資料列失敗 (${res.status})`,
    );
  }
}

/**
 * Deletes a post row (1-based rowIndex) from the connected Google Sheet using batchUpdate.
 */
export async function deletePostFromSheet(
  spreadsheetId: string,
  sheetId: number,
  rowIndex: number,
  accessToken: string,
): Promise<void> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId,
    )}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message || `刪除 Google Sheet 資料列失敗 (${res.status})`,
    );
  }
}

/**
 * Public unauthenticated read via Google Visualization API (works on GitHub Pages
 * when the Google Sheet is shared as "Anyone with the link can view").
 */
export async function fetchPostsFromPublicGviz(
  spreadsheetId: string,
  tabName?: string,
): Promise<JournalPost[]> {
  const sheetParam = tabName ? `&sheet=${encodeURIComponent(tabName)}` : '';
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    spreadsheetId,
  )}/gviz/tq?tqx=out:json${sheetParam}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `無法讀取公開試算表 (${res.status})，請確認試算表權限已設為「知道連結的任何人均可檢視」。`,
    );
  }

  const text = await res.text();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('公開試算表回應格式無法解析，請確認試算表已公開分享。');
  }

  const json = JSON.parse(text.slice(start, end + 1));
  if (json.status === 'error') {
    throw new Error(json.errors?.[0]?.detailed_message || '讀取公開試算表錯誤');
  }

  const cols: Array<{label?: string; id?: string}> = json.table?.cols || [];
  const rows: Array<{c: Array<{v: unknown; f?: string} | null>}> =
    json.table?.rows || [];

  const headerLabels = cols.map((c) => c.label || c.id || '');
  const hasExplicitHeaderLabels = headerLabels.some((h) =>
    ['slug', 'title', '標題', '文章標題'].includes(normalizeHeaderKey(h)),
  );

  let dataRows = rows.map((r) =>
    (r.c || []).map((cell) => (cell ? cell.f ?? cell.v ?? '' : '')),
  );
  let headerMap: Record<string, number>;

  if (hasExplicitHeaderLabels) {
    headerMap = buildHeaderMap(headerLabels);
  } else if (dataRows.length > 0) {
    headerMap = buildHeaderMap(dataRows[0]);
    dataRows = dataRows.slice(1);
  } else {
    return [];
  }

  const posts: JournalPost[] = [];
  dataRows.forEach((row, idx) => {
    const parsed = rowToPost(row, headerMap, idx + 2);
    if (parsed) posts.push(parsed);
  });
  return posts;
}

export function exportPostsAsJson(posts: JournalPost[]): string {
  return JSON.stringify(
    posts.map(({rowIndex: _row, ...rest}) => rest),
    null,
    2,
  );
}

export function exportPostsAsCsv(posts: JournalPost[]): string {
  const escapeCsv = (val: string) => {
    const safe = val.replace(/"/g, '""');
    return `"${safe}"`;
  };
  const header = SHEET_HEADERS.map((h) => escapeCsv(h)).join(',');
  const lines = posts.map((p) =>
    postToRow(p)
      .map((cell) => escapeCsv(cell))
      .join(','),
  );
  return [header, ...lines].join('\n');
}

export function inferEmbedProvider(url?: string): {
  provider: 'Google Drive' | 'Google Meet' | 'Google Forms' | 'Google Sheets' | 'External';
  domain: string;
} {
  if (!url) return {provider: 'External', domain: ''};
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (host.includes('drive.google.com')) {
      return {provider: 'Google Drive', domain: host};
    }
    if (host.includes('meet.google.com')) {
      return {provider: 'Google Meet', domain: host};
    }
    if (host.includes('docs.google.com')) {
      if (parsed.pathname.includes('/forms/')) {
        return {provider: 'Google Forms', domain: host};
      }
      if (parsed.pathname.includes('/spreadsheets/')) {
        return {provider: 'Google Sheets', domain: host};
      }
      return {provider: 'Google Drive', domain: host};
    }
    return {provider: 'External', domain: host};
  } catch {
    return {provider: 'External', domain: ''};
  }
}
