import { useState } from 'react'
import { useWeb3 } from '@/hooks/useWeb3'
import WalletConnect from '@/components/WalletConnect'
import BalanceDisplay from '@/components/BalanceDisplay'
import GnosisSafeInterface from '@/components/GnosisSafeInterface'

function App() {
  const web3 = useWeb3()
  const [safeUrl, setSafeUrl] = useState('')

  const handleLoadSafe = async () => {
    if (!safeUrl.trim()) {
      alert('Insira um endereço de Gnosis Safe válido')
      return
    }

    try {
      await web3.getSafeInfo(safeUrl)
    } catch (err) {
      console.error('Failed to load safe:', err)
      alert('Erro ao carregar Safe. Verifique o endereço e tente novamente.')
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🙏 Igreja nas Casas — Web3</h1>
          <p className="tagline">Doações Transparentes & Yield Farming</p>
        </div>

        <div className="header-status">
          {web3.account ? (
            <span className="status-connected">
              ✓ Conectado
            </span>
          ) : (
            <span className="status-disconnected">
              ○ Desconectado
            </span>
          )}
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          {/* Wallet Connection */}
          <section className="section">
            <WalletConnect
              account={web3.account}
              balance={web3.balance}
              isConnecting={web3.isConnecting}
              error={web3.error}
              onConnect={web3.connectWallet}
              onDisconnect={web3.disconnectWallet}
            />
          </section>

          {/* Safe Address Input */}
          {web3.account && (
            <section className="section">
              <div className="safe-loader">
                <h2>Carregar Gnosis Safe</h2>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="0x..."
                    value={safeUrl}
                    onChange={e => setSafeUrl(e.target.value)}
                    className="safe-input"
                  />
                  <button
                    onClick={handleLoadSafe}
                    className="btn btn-primary"
                  >
                    Carregar Safe
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Balance Display */}
          {web3.account && (
            <section className="section">
              <BalanceDisplay
                walletBalance={web3.balance}
                safeBalance={web3.safeBalance}
                account={web3.account}
                safeAddress={web3.safeAddress}
              />
            </section>
          )}

          {/* Gnosis Safe Interface */}
          {web3.account && (
            <section className="section">
              <GnosisSafeInterface
                safeAddress={web3.safeAddress}
                isConnected={!!web3.account}
              />
            </section>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>
          Igreja nas Casas &copy; {new Date().getFullYear()} — Desenvolvido com
          React + Web3 + Gnosis Safe
        </p>
        <p className="security-notice">
          ⚠️ Esta é uma interface de demonstração. Sempre verifique contratos
          em auditorias profissionais antes de usar em produção.
        </p>
      </footer>

      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
            'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans',
            'Helvetica Neue', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .app {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .app-header {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-content h1 {
          margin: 0 0 4px 0;
          font-size: 28px;
          color: #333;
          background: linear-gradient(135deg, #667eea, #764ba2);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .tagline {
          margin: 0;
          font-size: 14px;
          color: #999;
        }

        .header-status {
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 20px;
          background: #f0f0f0;
        }

        .status-connected {
          color: #1ed760;
        }

        .status-disconnected {
          color: #ffa500;
        }

        .app-main {
          flex: 1;
          padding: 40px 20px;
          overflow-y: auto;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .section {
          margin-bottom: 32px;
        }

        .safe-loader {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .safe-loader h2 {
          margin: 0 0 16px 0;
          font-size: 20px;
          color: #333;
        }

        .input-group {
          display: flex;
          gap: 8px;
        }

        .safe-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-family: monospace;
          font-size: 14px;
        }

        .safe-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn-primary {
          background-color: #667eea;
          color: white;
        }

        .btn-primary:hover {
          background-color: #5568d3;
          transform: translateY(-2px);
        }

        .app-footer {
          background: rgba(255, 255, 255, 0.95);
          padding: 24px;
          text-align: center;
          border-top: 1px solid #eee;
        }

        .app-footer p {
          margin: 6px 0;
          color: #666;
          font-size: 14px;
        }

        .security-notice {
          color: #c33;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .app-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .header-content h1 {
            font-size: 22px;
          }

          .app-main {
            padding: 20px 12px;
          }
        }
      `}</style>
    </div>
  )
}

export default App
