import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.ethereum
Object.defineProperty(window, 'ethereum', {
  value: undefined,
  writable: true,
  configurable: true,
})

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(),
  },
  writable: true,
  configurable: true,
})
