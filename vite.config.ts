import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so dist/ works wherever it's uploaded on Turbify.
  base: './',
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
  },
})
