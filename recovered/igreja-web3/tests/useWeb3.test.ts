import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWeb3 } from '@/hooks/useWeb3'

describe('useWeb3 Hook', () => {
  beforeEach(() => {
    delete (window as any).ethereum
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useWeb3())

    expect(result.current.provider).toBeNull()
    expect(result.current.account).toBeNull()
    expect(result.current.balance).toBe('0')
    expect(result.current.isConnecting).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.safeAddress).toBeNull()
    expect(result.current.safeBalance).toBe('0')
  })

  it('should fail gracefully when ethereum is not available', async () => {
    const { result } = renderHook(() => useWeb3())

    await act(async () => {
      await result.current.connectWallet()
    })

    expect(result.current.error).toContain('MetaMask or WalletConnect not detected')
    expect(result.current.account).toBeNull()
  })

  it('should disconnect wallet', async () => {
    const { result } = renderHook(() => useWeb3())

    await act(async () => {
      await result.current.disconnectWallet()
    })

    expect(result.current.provider).toBeNull()
    expect(result.current.account).toBeNull()
    expect(result.current.balance).toBe('0')
  })

  it('should provide all Web3 functions', () => {
    const { result } = renderHook(() => useWeb3())

    expect(typeof result.current.connectWallet).toBe('function')
    expect(typeof result.current.disconnectWallet).toBe('function')
    expect(typeof result.current.getSafeInfo).toBe('function')
    expect(typeof result.current.signMessage).toBe('function')
  })

  it('should handle connection errors gracefully', async () => {
    const { result } = renderHook(() => useWeb3())

    const mockEthereum = {
      send: vi.fn().mockRejectedValue(new Error('User denied account access')),
    }

    window.ethereum = mockEthereum

    await act(async () => {
      await result.current.connectWallet()
    })

    expect(result.current.error).toBeDefined()
    expect(result.current.isConnecting).toBe(false)
  })
})
