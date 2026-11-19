export type PostStatus = 'Published' | 'Draft';

export interface EmbedResource {
  url: string;
  label: string;
  provider: 'Google Drive' | 'Google Meet' | 'Google Forms' | 'Google Sheets' | 'External';
}

export interface JournalPost {
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  academicYear: string;
  publishedAt: string;
  author: string;
  isFeatured: boolean;
  status: PostStatus;
  coverImageUrl?: string;
  embedUrl?: string;
  embedLabel?: string;
  rowIndex?: number; // 1-based row index inside Google Sheet (header is row 1)
}

export type DataSourceMode = 'seed' | 'sheets-api' | 'sheets-public' | 'local-json';

export interface SpreadsheetTabInfo {
  sheetId: number;
  title: string;
}

export interface SpreadsheetMeta {
  spreadsheetId: string;
  title: string;
  tabs: SpreadsheetTabInfo[];
  activeTab: string;
}

export interface ConfirmActionState {
  isOpen: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel: string;
  isDestructive?: boolean;
  onConfirm: () => Promise<void> | void;
}
