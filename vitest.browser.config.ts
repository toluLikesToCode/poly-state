/// <reference types="vitest" />
import {defineConfig} from 'vitest/config'
import react from '@vitejs/plugin-react'
import {ensureCryptoHash} from './test/utils/cryptoHashPolyfill'

// Backfill crypto.hash for Node 18 in CI before Vite bootstraps
ensureCryptoHash()

export default defineConfig({
  plugins: [
    react({
      // Enable React testing features in browser mode
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
    }),
  ],
  test: {
    // Enable browser mode
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      screenshotFailures: false,
      instances: [
        {
          browser: 'chromium',
        },
      ],
      // Configure browser environment for React
      isolate: true,
    },

    // Browser-specific test patterns
    include: ['test/browser/**/*.browser.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['test/core/**/*', 'test/react/**/*', 'node_modules', 'dist', 'examples'],

    // Browser test environment setup
    setupFiles: ['./test/browser/setup.ts'],

    // Global test configuration
    globals: true,
    testTimeout: 10000,

    // Environment configuration for React
    environment: 'jsdom', // Alternative: 'happy-dom' for more browser-like behavior

    // Coverage for browser tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        'test/**',
        'examples/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/node_modules/**',
      ],
    },
  },

  // Build configuration for browser tests
  esbuild: {
    target: 'esnext',
  },
})
