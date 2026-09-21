// Google Drive folder picker for the Sources page - lets an admin browse and select a folder
// visually instead of copying a folder ID out of a Drive URL. Deliberately requests only the
// drive.file scope here (matching the API's OAuth flow in SourceOAuthEndpoints.cs): picking a
// folder through this widget is what GRANTS the app access to it, rather than the app already
// having blanket read access to the whole Drive and just needing an ID. See that file's comment
// for why this scope choice matters for getting the app out of Google's "testing" mode without a
// paid security assessment.
//
// Both env vars are optional - callers should fall back to the manual paste input when either is
// missing (unset in local/dev, or before the founder has created a Google Cloud "API key" for the
// Picker API in production).
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY ?? "";
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export function isGooglePickerConfigured(): boolean {
  return Boolean(CLIENT_ID && API_KEY);
}

export type PickedFolder = { id: string; name: string };

let scriptsPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

// Both Google Identity Services (the token client, for the OAuth popup) and the classic gapi
// loader (the Picker widget itself still ships as a gapi module, not a GIS one) are needed - the
// two libraries were never merged for Picker.
function loadGoogleScripts(): Promise<void> {
  if (!scriptsPromise) {
    scriptsPromise = Promise.all([loadScript("https://accounts.google.com/gsi/client"), loadScript("https://apis.google.com/js/api.js")]).then(
      () => undefined
    );
  }
  return scriptsPromise;
}

function loadPickerModule(): Promise<void> {
  return new Promise((resolve) => {
    (window as any).gapi.load("picker", () => resolve());
  });
}

// Opens the account chooser + consent popup (only asks again if the user hasn't already granted
// drive.file to this app), then the folder browser. Resolves with the chosen folder, or null if
// the user closed either dialog without picking one.
export async function pickGoogleDriveFolder(): Promise<PickedFolder | null> {
  if (!isGooglePickerConfigured()) {
    throw new Error("Google Picker isn't configured on this deployment.");
  }

  await loadGoogleScripts();
  await loadPickerModule();

  const accessToken: string = await new Promise((resolve, reject) => {
    const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_FILE_SCOPE,
      callback: (resp: any) => {
        if (resp?.access_token) resolve(resp.access_token);
        else reject(new Error(resp?.error_description ?? "Google didn't grant access."));
      },
      error_callback: (err: any) => reject(new Error(err?.message ?? "Google sign-in was cancelled.")),
    });
    tokenClient.requestAccessToken({ prompt: "" });
  });

  return new Promise((resolve) => {
    const google = (window as any).google;
    const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setIncludeFolders(true)
      .setMode(google.picker.DocsViewMode.LIST);

    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .setTitle("Choose a folder for CertiWatch to watch")
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs?.[0];
          resolve(doc ? { id: doc.id, name: doc.name } : null);
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}
