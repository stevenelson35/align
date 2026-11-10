import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Shown in Help → About, so it's easy to tell which version a phone is running.
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
})()

/**
 * dist/owntracks.php: the OwnTracks relay (scripts/location/README.md) with the Apps Script URL filled in. The URL comes
 * from .env.production.local, so it stays out of the repo; it must be a plain Apps Script URL to go inside PHP quotes.
 */
function ownTracksRelay(appsScriptUrl: string | undefined): Plugin {
  return {
    name: 'owntracks-relay',
    apply: 'build',
    generateBundle() {
      if (!appsScriptUrl) return
      if (!/^https:\/\/script\.google\.com\/[A-Za-z0-9/_.-]+$/.test(appsScriptUrl)) {
        this.error('VITE_CALENDAR_SYNC_URL must be a plain https://script.google.com/… web app URL for owntracks.php.')
      }
      const template = readFileSync('scripts/location/owntracks-relay.php', 'utf8')
      this.emitFile({ type: 'asset', fileName: 'owntracks.php', source: template.replace('__ALIGN_APPS_SCRIPT_URL__', appsScriptUrl) })
    },
  }
}

function wordleEndpoint(): Plugin {
  return {
    name: 'wordle-endpoint',
    apply: 'build',
    generateBundle() {
      const source = readFileSync('scripts/wordle/wordle-api.php', 'utf8')
      this.emitFile({ type: 'asset', fileName: 'wordle.php', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), ownTracksRelay(loadEnv(mode, process.cwd(), 'VITE_').VITE_CALENDAR_SYNC_URL), wordleEndpoint()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  // Relative asset paths so dist/ works wherever it's uploaded on Turbify.
  base: './',
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
  },
}))
