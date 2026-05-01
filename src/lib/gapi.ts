/**
 * Google Identity Services (GIS) wrapper.
 * No external packages — uses dynamic script loading and fetch().
 */

// ─── GIS Type declarations ────────────────────────────────────────────────────

interface TokenClientConfig {
  client_id: string;
  scope: string;
  prompt: '' | 'none';
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string }) => void;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: Partial<TokenClientConfig>) => void;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GisAccounts {
  oauth2: {
    initTokenClient(config: TokenClientConfig): TokenClient;
  };
}

interface GisApi {
  accounts: GisAccounts;
}

declare global {
  interface Window {
    google?: GisApi;
  }
}

// ─── iOS PWA detection ────────────────────────────────────────────────────────

/**
 * Returns true when running as an installed PWA on iOS (standalone mode).
 * In this mode, window.open() spawns a separate Safari process and the
 * OAuth postMessage callback never reaches the PWA — sign-in silently breaks.
 */
export function isIosPwa(): boolean {
  return (
    // @ts-expect-error navigator.standalone is iOS-only
    typeof navigator.standalone === 'boolean' && navigator.standalone === true
  );
}

// ─── Script loading ───────────────────────────────────────────────────────────

let gisLoadPromise: Promise<void> | null = null;

export async function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return;

  if (!gisLoadPromise) {
    gisLoadPromise = new Promise<void>((resolve, reject) => {
      // Already injected but not yet loaded?
      const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('GIS script failed to load')));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('GIS script failed to load'));
      document.head.appendChild(script);
    });
  }

  return gisLoadPromise;
}

// ─── Token acquisition ────────────────────────────────────────────────────────

export async function requestToken(
  clientId: string,
  scopes: string,
  silent: boolean,
): Promise<string> {
  if (!silent && isIosPwa()) {
    throw new Error('IOS_PWA_POPUP_BLOCKED');
  }
  await loadGis();

  return new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes,
      prompt: silent ? 'none' : '',
      callback: (response: TokenResponse) => {
        if (response.access_token) {
          resolve(response.access_token);
        } else {
          reject(new Error(response.error ?? 'Token request failed'));
        }
      },
      error_callback: (error: { type: string }) => {
        reject(new Error(error.type));
      },
    });

    client.requestAccessToken();
  });
}

// ─── User info ────────────────────────────────────────────────────────────────

export async function getUserInfo(token: string): Promise<{ email: string; name: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`getUserInfo failed: ${res.status}`);
  }

  const data = await res.json() as { email: string; name: string };
  return { email: data.email, name: data.name };
}

// ─── Drive appDataFolder helpers ──────────────────────────────────────────────

const BACKUP_FILE_NAME = 'iron-log-backup.json';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

export async function findBackupFile(token: string): Promise<string | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id,name)',
    q: `name = '${BACKUP_FILE_NAME}'`,
  });

  const res = await fetch(`${DRIVE_FILES_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`findBackupFile failed: ${res.status}`);
  }

  const data = await res.json() as { files: Array<{ id: string; name: string }> };
  return data.files.length > 0 ? data.files[0].id : null;
}

export async function downloadBackup(token: string, fileId: string): Promise<unknown> {
  const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`downloadBackup failed: ${res.status}`);
  }

  return res.json();
}

export async function uploadBackup(
  token: string,
  data: unknown,
  existingFileId: string | null,
): Promise<string> {
  const body = JSON.stringify(data);
  const blob = new Blob([body], { type: 'application/json' });

  if (existingFileId) {
    // Update existing file
    const res = await fetch(`${DRIVE_UPLOAD_URL}/${existingFileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: blob,
    });

    if (!res.ok) {
      throw new Error(`uploadBackup (update) failed: ${res.status}`);
    }

    const result = await res.json() as { id: string };
    return result.id;
  } else {
    // Create new file in appDataFolder
    // Use multipart upload to set metadata + content in one request
    const metadata = {
      name: BACKUP_FILE_NAME,
      parents: ['appDataFolder'],
    };

    const boundary = 'iron_log_boundary';
    const multipart = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      body,
      `--${boundary}--`,
    ].join('\r\n');

    const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    });

    if (!res.ok) {
      throw new Error(`uploadBackup (create) failed: ${res.status}`);
    }

    const result = await res.json() as { id: string };
    return result.id;
  }
}
