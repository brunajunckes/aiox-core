/**
 * Web3 Integration Library for Igreja nas Casas
 * Handles Chiesa.sol interactions via ethers.js v6
 */

import { ethers, Contract, BrowserProvider } from 'ethers'
import { ChiesaABI } from './abis/Chiesa'

interface DonationEvent {
  donor: string
  amount: string
  timestamp: number
}

interface ChurchBalance {
  totalDonations: string
  totalYieldGenerated: string
  yieldDistributedToChurch: string
}

export class Web3Integration {
  private provider: BrowserProvider | null = null
  private signer: ethers.Signer | null = null
  private chiesa: Contract | null = null
  private chiesiAddress: string
  private connected: boolean = false

  constructor(chiesiAddress: string) {
    this.chiesiAddress = chiesiAddress
  }

  /**
   * Connect wallet via MetaMask
   */
  async connectWallet(): Promise<string> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask is not installed')
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })

      this.provider = new BrowserProvider(window.ethereum)
      this.signer = await this.provider.getSigner()
      this.chiesa = new Contract(this.chiesiAddress, ChiesaABI, this.signer)
      this.connected = true

      return accounts[0]
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      throw error
    }
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Get current connected account
   */
  async getAccount(): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected')
    }
    return await this.signer.getAddress()
  }

  /**
   * Get Chiesa contract balance and yield info
   */
  async getChurchBalance(): Promise<ChurchBalance> {
    if (!this.chiesa) {
      throw new Error('Chiesa contract not initialized')
    }

    try {
      const totalDonations = await this.chiesa.totalDonations()
      const totalYieldGenerated = await this.chiesa.totalYieldGenerated()
      const yieldDistributedToChurch = await this.chiesa.yieldDistributedToChurch()

      return {
        totalDonations: ethers.formatUnits(totalDonations, 6),
        totalYieldGenerated: ethers.formatUnits(totalYieldGenerated, 6),
        yieldDistributedToChurch: ethers.formatUnits(yieldDistributedToChurch, 6)
      }
    } catch (error) {
      console.error('Failed to get church balance:', error)
      throw error
    }
  }

  /**
   * Get user's donation history
   */
  async getUserDonationAmount(userAddress: string): Promise<string> {
    if (!this.chiesa) {
      throw new Error('Chiesa contract not initialized')
    }

    try {
      const amount = await this.chiesa.donationsByUser(userAddress)
      return ethers.formatUnits(amount, 6)
    } catch (error) {
      console.error('Failed to get user donation amount:', error)
      throw error
    }
  }

  /**
   * Donate USDC to the church
   * @param amount Amount in USDC (with decimals: 1 USDC = 1,000,000 units)
   */
  async donate(amount: string): Promise<string> {
    if (!this.chiesa) {
      throw new Error('Chiesa contract not initialized')
    }

    try {
      const amountWei = ethers.parseUnits(amount, 6)
      const tx = await this.chiesa.donate(amountWei)
      const receipt = await tx.wait()

      if (!receipt) {
        throw new Error('Transaction failed')
      }

      return receipt.hash
    } catch (error) {
      console.error('Failed to donate:', error)
      throw error
    }
  }

  /**
   * Get list of all donors
   */
  async getDonors(): Promise<string[]> {
    if (!this.chiesa) {
      throw new Error('Chiesa contract not initialized')
    }

    try {
      const donorCount = await this.chiesa.donors.length || 0
      const donors: string[] = []

      for (let i = 0; i < donorCount; i++) {
        const donor = await this.chiesa.donors(i)
        donors.push(donor)
      }

      return donors
    } catch (error) {
      console.error('Failed to get donors list:', error)
      return []
    }
  }

  /**
   * Listen to donation events
   */
  listenToDonationEvents(
    callback: (event: DonationEvent) => void
  ): () => void {
    if (!this.chiesa) {
      throw new Error('Chiesa contract not initialized')
    }

    const listener = (donor: string, amount: ethers.BigNumberish, timestamp: ethers.BigNumberish) => {
      callback({
        donor,
        amount: ethers.formatUnits(amount as string, 6),
        timestamp: Number(timestamp)
      })
    }

    this.chiesa.on('DonationReceived', listener)

    return () => {
      this.chiesa?.removeListener('DonationReceived', listener)
    }
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.connected = false
    this.provider = null
    this.signer = null
    this.chiesa = null
  }
}

// Export singleton instance
export const createWeb3Integration = (chiesiAddress: string): Web3Integration => {
  return new Web3Integration(chiesiAddress)
}
