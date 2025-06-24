// Test setup file for Vitest
import {vi, beforeEach, afterEach} from 'vitest'
import '@testing-library/jest-dom'

// Mock localStorage for testing
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock sessionStorage for testing
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
})

// Mock isDevMode globally for all tests
vi.mock('../src/core/utils/devMode', () => ({
  isDevMode: vi.fn(() => true), // Default mock implementation
}))

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock.clear()
  sessionStorageMock.clear()
})

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks()
})

// Global test utilities
declare global {
  var localStorageMock: {
    getItem: ReturnType<typeof vi.fn>
    setItem: ReturnType<typeof vi.fn>
    removeItem: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
    length: number
    key: ReturnType<typeof vi.fn>
  }
  var sessionStorageMock: {
    getItem: ReturnType<typeof vi.fn>
    setItem: ReturnType<typeof vi.fn>
    removeItem: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
    length: number
    key: ReturnType<typeof vi.fn>
  }
}

globalThis.localStorageMock = localStorageMock
globalThis.sessionStorageMock = sessionStorageMock
