/// <reference types="vitest" />
import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    // Enable browser mode
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true, // Set to false for debugging
      screenshotFailures: false,
      instances: [
        {
          browser: 'chromium',
        },
      ],
    },

    // Browser-specific test patterns
    include: ['test/browser/**/*.browser.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['test/core/**/*', 'test/react/**/*', 'node_modules', 'dist', 'examples'],

    // Browser test environment setup
    setupFiles: ['./test/browser/setup.ts'],

    // Global test configuration
    globals: true,
    testTimeout: 10000,

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
