export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file" as const;
export const GOOGLE_DRIVE_FOLDER_NAME = "APU Audity";

type TokenResponse = { access_token?: string; error?: string; error_description?: string };
type GoogleTokenClient = { requestAccessToken: (options?: { prompt?: string }) => void };
type GoogleIdentity = {
  accounts: { oauth2: {
    initTokenClient: (config: { client_id: string; scope: string; callback: (response: TokenResponse) => void; error_callback?: (error: unknown) => void }) => GoogleTokenClient;
    hasGrantedAllScopes?: (response: TokenResponse, ...scopes: string[]) => boolean;
  } };
};

declare global { interface Window { google?: GoogleIdentity } }

export type DriveUploadResult = { id: string; name: string; webViewLink?: string };
export type DriveFetch = typeof fetch;

let scriptPromise: Promise<void> | null = null;

export function loadGoogleIdentityScript() {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google OAuth knihovnu se nepodařilo načíst."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function requestDriveAccessToken(clientId: string) {
  const request = () => new Promise<string>((resolve, reject) => {
    const oauth = window.google?.accounts.oauth2;
    if (!oauth) return reject(new Error("Google OAuth není dostupný."));
    const client = oauth.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: (response) => {
        if (!response.access_token) return reject(new Error(response.error_description || response.error || "Google účet přístup nepovolil."));
        if (oauth.hasGrantedAllScopes && !oauth.hasGrantedAllScopes(response, GOOGLE_DRIVE_SCOPE)) {
          return reject(new Error("Nebyl povolen požadovaný omezený přístup k souborům APU."));
        }
        resolve(response.access_token);
      },
      error_callback: () => reject(new Error("Připojení Google účtu bylo přerušeno.")),
    });
    client.requestAccessToken();
  });
  if (window.google?.accounts.oauth2) return request();
  await loadGoogleIdentityScript();
  return request();
}

async function driveJson<T>(fetcher: DriveFetch, url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init?.headers ?? {}) },
  });
  const value = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(value.error?.message || "Google Drive požadavek selhal.");
  return value as T;
}

export async function ensureAuditFolder(accessToken: string, fetcher: DriveFetch = fetch) {
  const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='apuAuditFolder' and value='v1' }`);
  const listed = await driveJson<{ files?: Array<{ id?: string; name?: string }> }>(fetcher, `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name)&pageSize=1`, accessToken);
  if (listed.files?.[0]?.id) return listed.files[0].id as string;
  const created = await driveJson<{ id: string }>(fetcher, "https://www.googleapis.com/drive/v3/files?fields=id", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: GOOGLE_DRIVE_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      appProperties: { apuAuditFolder: "v1" },
    }),
  });
  return created.id as string;
}

export async function uploadAuditToDrive(input: {
  accessToken: string;
  filename: string;
  html: string;
  fetcher?: DriveFetch;
}): Promise<DriveUploadResult> {
  const fetcher = input.fetcher ?? fetch;
  const folderId = await ensureAuditFolder(input.accessToken, fetcher);
  const boundary = `apu_audit_${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name: input.filename, parents: [folderId], mimeType: "text/html" });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${input.html}\r\n--${boundary}--`;
  return driveJson<DriveUploadResult>(fetcher, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", input.accessToken, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}
