import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { createWeb3Integration } from '@/lib/web3-integration'

export default function Home() {
  const { data: session } = useSession()
  const [walletConnected, setWalletConnected] = useState(false)
  const [account, setAccount] = useState<string>('')
  const [churchBalance, setChurchBalance] = useState({
    totalDonations: '0',
    totalYieldGenerated: '0',
    yieldDistributedToChurch: '0'
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (walletConnected && account) {
      fetchChurchBalance()
    }
  }, [walletConnected, account])

  const connectWallet = async () => {
    try {
      setLoading(true)
      const chiesiAddress = process.env.NEXT_PUBLIC_CHIESA_ADDRESS || ''
      const web3 = createWeb3Integration(chiesiAddress)
      const connectedAccount = await web3.connectWallet()
      setAccount(connectedAccount)
      setWalletConnected(true)
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      alert('Failed to connect wallet. Please check MetaMask.')
    } finally {
      setLoading(false)
    }
  }

  const fetchChurchBalance = async () => {
    try {
      const chiesiAddress = process.env.NEXT_PUBLIC_CHIESA_ADDRESS || ''
      const web3 = createWeb3Integration(chiesiAddress)
      await web3.connectWallet()
      const balance = await web3.getChurchBalance()
      setChurchBalance(balance)
    } catch (error) {
      console.error('Failed to fetch balance:', error)
    }
  }

  return (
    <>
      <Head>
        <title>Igreja Admin Dashboard</title>
        <meta name="description" content="Igreja nas Casas Admin Dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-church-50 to-church-100">
        <header className="bg-white shadow-sm">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-church-800">Igreja Admin</h1>
            <div className="space-x-4">
              {!walletConnected ? (
                <button
                  onClick={connectWallet}
                  disabled={loading}
                  className="px-4 py-2 bg-church-600 text-white rounded-lg hover:bg-church-700 disabled:opacity-50"
                >
                  {loading ? 'Connecting...' : 'Connect Wallet'}
                </button>
              ) : (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">{account?.slice(0, 6)}...{account?.slice(-4)}</span>
                  {!session && (
                    <button
                      onClick={() => signIn()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Sign In
                    </button>
                  )}
                </div>
              )}
            </div>
          </nav>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-3xl font-bold text-church-800 mb-8">Dashboard</h2>

          {walletConnected && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total Donations</h3>
                <p className="text-3xl font-bold text-church-600">${churchBalance.totalDonations}</p>
                <p className="text-xs text-gray-500 mt-2">USDC</p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total Yield</h3>
                <p className="text-3xl font-bold text-green-600">${churchBalance.totalYieldGenerated}</p>
                <p className="text-xs text-gray-500 mt-2">From Aave</p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Distributed</h3>
                <p className="text-3xl font-bold text-blue-600">${churchBalance.yieldDistributedToChurch}</p>
                <p className="text-xs text-gray-500 mt-2">To Church</p>
              </div>
            </div>
          )}

          {!walletConnected && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <h3 className="text-xl font-semibold text-gray-700 mb-4">Get Started</h3>
              <p className="text-gray-600 mb-6">Connect your wallet to view the dashboard</p>
              <button
                onClick={connectWallet}
                disabled={loading}
                className="px-6 py-3 bg-church-600 text-white rounded-lg hover:bg-church-700 disabled:opacity-50 font-semibold"
              >
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
