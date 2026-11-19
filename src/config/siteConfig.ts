/**
 * 若您希望所有 GitHub Pages 訪客打開首頁即自動載入同一份公開 Google Sheet，
 * 請將您的試算表 ID（位於試算表網址 /spreadsheets/d/ 與 /edit 之間）
 * 填入下方的 DEFAULT_PUBLIC_SHEET_ID，或於建置環境設定 VITE_DEFAULT_SHEET_ID。
 *
 * 提醒：該份試算表須在 Google 雲端硬碟設為「知道連結的任何人均可檢視」。
 */
export const DEFAULT_PUBLIC_SHEET_ID: string =
  import.meta.env.VITE_DEFAULT_SHEET_ID ||
  '1TYrCzrvZgxwd9nxygksgpUOSJVRb1L3aXCxtDIo4_4E';

export const DEFAULT_PUBLIC_SHEET_TAB: string | undefined =
  import.meta.env.VITE_DEFAULT_SHEET_TAB || 'Posts';
