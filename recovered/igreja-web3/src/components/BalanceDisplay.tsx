import { FC, useEffect, useState } from 'react'

interface BalanceDisplayProps {
  walletBalance: string
  safeBalance: string
  account: string | null
  safeAddress: string | null
}

interface BalanceInfo {
  type: 'wallet' | 'safe'
  label: string
  balance: string
  icon: string
  usdValue?: string
}

const BalanceDisplay: FC<BalanceDisplayProps> = ({
  walletBalance,
  safeBalance,
  account,
  safeAddress,
}) => {
  const [ethPrice, setEthPrice] = useState<number>(0)
  const [balances, setBalances] = useState<BalanceInfo[]>([])

  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
        )
        const data = await response.json()
        setEthPrice(data.ethereum?.usd || 0)
      } catch (err) {
        console.warn('Failed to fetch ETH price:', err)
        setEthPrice(0)
      }
    }

    fetchEthPrice()
  }, [])

  useEffect(() => {
    const newBalances: BalanceInfo[] = []

    if (account) {
      newBalances.push({
        type: 'wallet',
        label: 'Carteira Pessoal',
        balance: walletBalance,
        icon: '👤',
        usdValue:
          ethPrice > 0
            ? `$${(parseFloat(walletBalance) * ethPrice).toFixed(2)}`
            : undefined,
      })
    }

    if (safeAddress) {
      newBalances.push({
        type: 'safe',
        label: 'Cofre Gnosis Safe',
        balance: safeBalance,
        icon: '🔐',
        usdValue:
          ethPrice > 0
            ? `$${(parseFloat(safeBalance) * ethPrice).toFixed(2)}`
            : undefined,
      })
    }

    setBalances(newBalances)
  }, [walletBalance, safeBalance, account, safeAddress, ethPrice])

  if (balances.length === 0) {
    return (
      <div className="balance-display-container">
        <div className="empty-state">
          <p>Conecte uma carteira para visualizar os saldos</p>
        </div>
      </div>
    )
  }

  return (
    <div className="balance-display-container">
      <h2>Saldos</h2>

      <div className="balance-grid">
        {balances.map(bal => (
          <div key={bal.type} className={`balance-card ${bal.type}`}>
            <div className="card-header">
              <span className="icon">{bal.icon}</span>
              <h3>{bal.label}</h3>
            </div>

            <div className="card-body">
              <div className="balance-amount">
                <span className="eth-value">{parseFloat(bal.balance).toFixed(4)} ETH</span>
                {bal.usdValue && <span className="usd-value">{bal.usdValue}</span>}
              </div>

              {bal.type === 'safe' && safeAddress && (
                <div className="address-info">
                  <small>Safe: {safeAddress.slice(0, 10)}...{safeAddress.slice(-8)}</small>
                </div>
              )}
            </div>

            <div className="card-footer">
              <small>Atualizado agora</small>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .balance-display-container {
          padding: 20px;
        }

        .balance-display-container h2 {
          margin: 0 0 20px 0;
          font-size: 20px;
          color: #333;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #999;
        }

        .balance-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
        }

        .balance-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .balance-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }

        .balance-card.wallet {
          border-top: 4px solid #667eea;
        }

        .balance-card.safe {
          border-top: 4px solid #1ed760;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f9f9f9;
          border-bottom: 1px solid #eee;
        }

        .icon {
          font-size: 24px;
        }

        .card-header h3 {
          margin: 0;
          font-size: 16px;
          color: #333;
        }

        .card-body {
          padding: 16px;
        }

        .balance-amount {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .eth-value {
          font-size: 28px;
          font-weight: 700;
          color: #333;
          font-family: monospace;
        }

        .usd-value {
          font-size: 14px;
          color: #999;
        }

        .address-info {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #eee;
        }

        .address-info small {
          color: #666;
          font-family: monospace;
          word-break: break-all;
        }

        .card-footer {
          padding: 12px 16px;
          background: #fafafa;
          border-top: 1px solid #eee;
          text-align: right;
        }

        .card-footer small {
          color: #999;
          font-size: 12px;
        }
      `}</style>
    </div>
  )
}

export default BalanceDisplay
