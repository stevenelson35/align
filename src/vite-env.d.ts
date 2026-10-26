/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_EMULATORS: string
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  /** Optional: the calendar sync web app (scripts/apps-script/README.md); enables "Refresh calendar". */
  readonly VITE_CALENDAR_SYNC_URL?: string
  /** Family map alerts: Firebase Cloud Messaging sender id and Web Push (VAPID) public key; both public. */
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_VAPID_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** The git commit and time the app was built (vite.config.ts), for Help → About. */
declare const __BUILD_COMMIT__: string
declare const __BUILD_TIME__: string
