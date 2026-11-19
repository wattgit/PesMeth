/**
 * Google Drive 圖檔上傳與公開連結管理服務
 *
 * 需配合 OAuth Scope: https://www.googleapis.com/auth/drive.file
 * 遵循最小權限原則：自動在 Google Drive 建立專屬「PesMath_Journal_Assets」資料夾，
 * 並將所有文章圖檔集中存放於該資料夾中，保持雲端硬碟整潔。
 */

export interface DriveUploadResult {
  fileId: string;
  name: string;
  directImageUrl: string;
  webViewLink: string;
}

// 記憶體快取已建立的專屬資料夾 ID，避免重複查詢
let cachedFolderId: string | null = null;

async function getOrCreatePesMathFolder(accessToken: string): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  const folderName = 'PesMath_Journal_Assets';

  try {
    // 1. 搜尋是否已存在同名資料夾
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      )}&fields=files(id,name)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        cachedFolderId = searchData.files[0].id;
        return cachedFolderId!;
      }
    }

    // 2. 若不存在則建立新資料夾
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        description: 'PesMath 數學教學社群期刊系統專屬圖檔與附件資料夾',
      }),
    });

    if (createRes.ok) {
      const folderData = await createRes.json();
      cachedFolderId = folderData.id;
      return cachedFolderId!;
    }
  } catch (err) {
    console.warn('Could not auto-create PesMath folder in Drive, falling back to root:', err);
  }

  return '';
}

/**
 * 將圖片檔案上傳至登入教師的 Google 雲端硬碟指定資料夾 (PesMath_Journal_Assets)，並設為公開檢視
 */
export async function uploadImageToGoogleDrive(
  file: File,
  accessToken: string,
): Promise<DriveUploadResult> {
  if (!accessToken) {
    throw new Error('未取得 Google 授權憑證，請先登入 Google 帳號。');
  }

  // 取得專屬資料夾 ID（若無則放根目錄）
  const folderId = await getOrCreatePesMathFolder(accessToken);

  // 1. 建立標準 Multipart/Related 檔案上傳主體
  const cleanName = `pesmath_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const metadata: any = {
    name: cleanName,
    mimeType: file.type || 'image/jpeg',
    description: '由 PesMath 教學期刊發布系統上傳之文章圖檔',
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = `-------PesMathDriveBoundary${Date.now().toString(36)}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    '\r\n';

  const fileHeader =
    `--${boundary}\r\n` +
    `Content-Type: ${file.type || 'image/jpeg'}\r\n\r\n`;

  const multipartBlob = new Blob(
    [metadataPart, fileHeader, file, closeDelimiter],
    {type: `multipart/related; boundary=${boundary}`},
  );

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: multipartBlob,
    },
  );

  if (!uploadRes.ok) {
    const errorJson = await uploadRes.json().catch(() => ({}));
    throw new Error(
      errorJson?.error?.message ||
        `Google Drive 上傳失敗 (HTTP ${uploadRes.status})。請確認已同意 Google Drive 存取權限。`,
    );
  }

  const fileData = await uploadRes.json();
  const fileId = fileData.id;

  // 2. 設定該圖檔權限為「知道連結的任何人均為檢視者」
  try {
    const permRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      },
    );
    if (!permRes.ok) {
      console.warn('Could not set public permission on drive file', await permRes.text());
    }
  } catch (err) {
    console.warn('Failed to set public reader permission:', err);
  }

  // 3. 組合高解析度且具備 CDN 快取的直連圖片網址
  const directImageUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
  const webViewLink =
    fileData.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

  return {
    fileId,
    name: fileData.name || cleanName,
    directImageUrl,
    webViewLink,
  };
}
