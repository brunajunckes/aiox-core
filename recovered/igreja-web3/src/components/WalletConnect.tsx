import { FC } from 'react'

interface WalletConnectProps {
  account: string | null
  balance: string
  isConnecting: boolean
  error: string | null
  onConnect: () => Promise<void>
  onDisconnect: () => void
}

const WalletConnect: FC<WalletConnectProps> = ({
  account,
  balance,
  isConnecting,
  error,
  onConnect,
  onDisconnect,
}) => {
  const displayAddress = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not connected'

  return (
    <div className="wallet-connect-container">
      <div className="wallet-card">
        <h2>Conectar Carteira</h2>

        {error && <div className="error-alert">{error}</div>}

        {account ? (
          <div className="wallet-info">
            <div className="info-row">
              <span className="label">Endereço:</span>
              <span className="value">{displayAddress}</span>
              <button
                className="copy-button"
                onClick={() => navigator.clipboard.writeText(account)}
                title="Copiar endereço completo"
              >
                📋
              </button>
            </div>
            <div className="info-row">
              <span className="label">Saldo:</span>
              <span className="value">{parseFloat(balance).toFixed(4)} ETH</span>
            </div>

            <button className="btn btn-secondary" onClick={onDisconnect}>
              Desconectar Carteira
            </button>
          </div>
        ) : (
          <div className="wallet-prompt">
            <p>Conecte uma carteira Web3 para começar</p>
            <button
              className="btn btn-primary"
              onClick={onConnect}
              disabled={isConnecting}
            >
              {isConnecting ? 'Conectando...' : 'Conectar MetaMask'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        .wallet-connect-container {
          padding: 20px;
        }

        .wallet-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          max-width: 400px;
        }

        .wallet-card h2 {
          margin: 0 0 20px 0;
          font-size: 20px;
          color: #333;
        }

        .error-alert {
          background-color: #fee;
          color: #c33;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          border-left: 4px solid #c33;
        }

        .wallet-info {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .info-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 8px;
        }

        .label {
          font-weight: 600;
          color: #666;
          min-width: 80px;
        }

        .value {
          font-family: monospace;
          color: #333;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .copy-button {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 4px;
          opacity: 0.7;
          transition: opacity 0.2s;
        }

        .copy-button:hover {
          opacity: 1;
        }

        .wallet-prompt {
          text-align: center;
        }

        .wallet-prompt p {
          color: #666;
          margin: 0 0 16px 0;
        }

        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
          width: 100%;
        }

        .btn-primary {
          background-color: #667eea;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #5568d3;
          transform: translateY(-2px);
        }

        .btn-secondary {
          background-color: #e0e0e0;
          color: #333;
        }

        .btn-secondary:hover {
          background-color: #d0d0d0;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}

export default WalletConnect
