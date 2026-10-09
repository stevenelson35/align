/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_EMULATORS: string
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  /** Optional: the calendar sync web app (scripts/apps-script/README.md); enables "Refresh calendar". */
  readonly VITE_CALENDAR_SYNC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
