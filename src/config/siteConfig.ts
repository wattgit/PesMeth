import siteConfig from '../../site-config.json';

/**
 * 全站預設 Google Sheet 資料庫設定
 *
 * 採用方案：存放在專案最外層的 /site-config.json
 * 開發時可由介面一鍵更新、或在根目錄直接修改，
 * 部署時直接與程式碼一氣呵成推上 Git，GitHub Pages 建置時自動採用！
 *
 * （若 GitHub 變數 VITE_DEFAULT_SHEET_ID 有設定則優先覆蓋）
 */
export const DEFAULT_PUBLIC_SHEET_ID: string =
  import.meta.env.VITE_DEFAULT_SHEET_ID ||
  siteConfig.spreadsheetId ||
  '';

export const DEFAULT_PUBLIC_SHEET_TAB: string | undefined =
  import.meta.env.VITE_DEFAULT_SHEET_TAB ||
  siteConfig.tabName ||
  'Posts';

export const BUNDLED_SITE_CONFIG = {
  spreadsheetId: siteConfig.spreadsheetId || '',
  tabName: siteConfig.tabName || 'Posts',
};

/**
 * 儲存全站預設 Google Sheet ID 至專案根目錄的 site-config.json
 * 在 AI Studio 開發時會直接透過 Vite dev API 寫入檔案，
 * 部署時直接 commit & push 即可一氣呵成！
 */
export async function saveSiteConfig(
  spreadsheetId: string,
  tabName: string = 'Posts',
): Promise<{success: boolean; message: string}> {
  const safeId = spreadsheetId.trim();
  const safeTab = tabName.trim() || 'Posts';
  if (!safeId) {
    return {success: false, message: '請先輸入有效的試算表 ID 或網址。'};
  }

  try {
    const res = await fetch('/api/save-site-config', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({spreadsheetId: safeId, tabName: safeTab}),
    });
    if (res.ok) {
      return {
        success: true,
        message:
          '已成功寫入專案根目錄 site-config.json！在 AI Studio 點擊 Push to GitHub 即可一氣呵成部署上線。',
      };
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${res.status}`);
  } catch (_err) {
    // 若在非開發環境或 API 無法連線，提供自動下載備份
    const jsonStr =
      JSON.stringify({spreadsheetId: safeId, tabName: safeTab}, null, 2) + '\n';
    const blob = new Blob([jsonStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'site-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return {
      success: true,
      message: '已為您下載 site-config.json，放入專案根目錄後推上 Git 即可生效！',
    };
  }
}
