import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vitest/config'

// Shown in Help → About, so it's easy to tell which version a phone is running.
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
})()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  // Relative asset paths so dist/ works wherever it's uploaded on Turbify.
  base: './',
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
  },
})
