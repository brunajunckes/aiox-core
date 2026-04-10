import { FC, useState } from 'react'

interface SafeTransaction {
  id: string
  to: string
  value: string
  data: string
  status: 'pending' | 'approved' | 'rejected' | 'executed'
  approvals: number
  requiredApprovals: number
  timestamp: number
}

interface GnosisSafeInterfaceProps {
  safeAddress: string | null
  isConnected: boolean
  onInitiateTx?: (txData: { to: string; value: string }) => Promise<void>
  onApproveTx?: (txId: string) => Promise<void>
  onExecuteTx?: (txId: string) => Promise<void>
}

const GnosisSafeInterface: FC<GnosisSafeInterfaceProps> = ({
  safeAddress,
  isConnected,
  onInitiateTx,
  onApproveTx,
  onExecuteTx,
}) => {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ to: '', value: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [transactions, setTransactions] = useState<SafeTransaction[]>([
    {
      id: 'tx-1',
      to: '0x742d35Cc6634C0532925a3b844Bc152e5f7ef7e8',
      value: '0.5',
      data: '0x',
      status: 'pending',
      approvals: 2,
      requiredApprovals: 5,
      timestamp: Date.now() - 3600000,
    },
  ])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.to || !formData.value) {
      alert('Preencha todos os campos')
      return
    }

    setIsSubmitting(true)
    try {
      if (onInitiateTx) {
        await onInitiateTx({ to: formData.to, value: formData.value })
      }

      const newTx: SafeTransaction = {
        id: `tx-${Date.now()}`,
        to: formData.to,
        value: formData.value,
        data: '0x',
        status: 'pending',
        approvals: 1,
        requiredApprovals: 5,
        timestamp: Date.now(),
      }

      setTransactions(prev => [newTx, ...prev])
      setFormData({ to: '', value: '' })
      setShowForm(false)
    } catch (err) {
      console.error('Failed to initiate transaction:', err)
      alert('Erro ao iniciar transação. Verifique o console.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApprove = async (txId: string) => {
    try {
      if (onApproveTx) {
        await onApproveTx(txId)
      }

      setTransactions(prev =>
        prev.map(tx =>
          tx.id === txId
            ? {
                ...tx,
                approvals: Math.min(tx.approvals + 1, tx.requiredApprovals),
                status:
                  tx.approvals + 1 >= tx.requiredApprovals ? 'approved' : 'pending',
              }
            : tx
        )
      )
    } catch (err) {
      console.error('Failed to approve transaction:', err)
      alert('Erro ao aprovar transação')
    }
  }

  const handleExecute = async (txId: string) => {
    try {
      if (onExecuteTx) {
        await onExecuteTx(txId)
      }

      setTransactions(prev =>
        prev.map(tx =>
          tx.id === txId ? { ...tx, status: 'executed' } : tx
        )
      )
    } catch (err) {
      console.error('Failed to execute transaction:', err)
      alert('Erro ao executar transação')
    }
  }

  if (!isConnected) {
    return (
      <div className="safe-interface-container">
        <div className="not-connected">
          <p>Conecte uma carteira para gerenciar o Gnosis Safe</p>
        </div>
      </div>
    )
  }

  return (
    <div className="safe-interface-container">
      <div className="safe-panel">
        <h2>Gnosis Safe Multi-Sig</h2>

        {safeAddress && (
          <div className="safe-address">
            <small>Safe: {safeAddress.slice(0, 10)}...{safeAddress.slice(-8)}</small>
          </div>
        )}

        <div className="panel-controls">
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancelar' : '+ Nova Transação'}
          </button>
        </div>

        {showForm && (
          <form className="transaction-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="to">Endereço Destinatário</label>
              <input
                id="to"
                type="text"
                name="to"
                placeholder="0x..."
                value={formData.to}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="value">Valor (ETH)</label>
              <input
                id="value"
                type="number"
                name="value"
                placeholder="0.5"
                step="0.001"
                min="0"
                value={formData.value}
                onChange={handleInputChange}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enviando...' : 'Propor Transação'}
            </button>
          </form>
        )}

        <div className="transactions-list">
          <h3>Transações Pendentes</h3>

          {transactions.length === 0 ? (
            <p className="empty-message">Nenhuma transação</p>
          ) : (
            <div className="tx-items">
              {transactions.map(tx => (
                <div key={tx.id} className={`tx-item ${tx.status}`}>
                  <div className="tx-header">
                    <span className="status-badge">{tx.status}</span>
                    <span className="tx-value">{tx.value} ETH</span>
                  </div>

                  <div className="tx-details">
                    <small>Para: {tx.to.slice(0, 12)}...{tx.to.slice(-8)}</small>
                    <small>
                      Aprovações: {tx.approvals}/{tx.requiredApprovals}
                    </small>
                  </div>

                  <div className="approval-bar">
                    <div
                      className="approval-progress"
                      style={{
                        width: `${(tx.approvals / tx.requiredApprovals) * 100}%`,
                      }}
                    />
                  </div>

                  {tx.status === 'pending' && (
                    <div className="tx-actions">
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleApprove(tx.id)}
                      >
                        Aprovar
                      </button>
                    </div>
                  )}

                  {tx.status === 'approved' && (
                    <div className="tx-actions">
                      <button
                        className="btn btn-sm btn-execute"
                        onClick={() => handleExecute(tx.id)}
                      >
                        Executar
                      </button>
                    </div>
                  )}

                  {tx.status === 'executed' && (
                    <div className="tx-actions">
                      <span className="completed">✓ Executada</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .safe-interface-container {
          padding: 20px;
        }

        .not-connected {
          text-align: center;
          padding: 40px 20px;
          color: #999;
        }

        .safe-panel {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .safe-panel h2 {
          margin: 0 0 12px 0;
          font-size: 20px;
          color: #333;
        }

        .safe-address {
          margin-bottom: 20px;
          padding: 8px 12px;
          background: #f0f0f0;
          border-radius: 6px;
        }

        .safe-address small {
          color: #666;
          font-family: monospace;
        }

        .panel-controls {
          margin-bottom: 20px;
        }

        .transaction-form {
          background: #f9f9f9;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          border-left: 4px solid #667eea;
        }

        .form-group {
          margin-bottom: 12px;
        }

        .form-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 6px;
          color: #333;
        }

        .form-group input {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-family: monospace;
          font-size: 14px;
        }

        .form-group input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .transactions-list {
          margin-top: 20px;
        }

        .transactions-list h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: #333;
        }

        .empty-message {
          color: #999;
          text-align: center;
          padding: 20px;
        }

        .tx-items {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .tx-item {
          padding: 16px;
          border: 1px solid #eee;
          border-radius: 8px;
          background: #fafafa;
          transition: all 0.2s;
        }

        .tx-item.pending {
          border-left: 4px solid #ffa500;
        }

        .tx-item.approved {
          border-left: 4px solid #4CAF50;
        }

        .tx-item.executed {
          border-left: 4px solid #1ed760;
          opacity: 0.7;
        }

        .tx-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .status-badge {
          background: #667eea;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .tx-value {
          font-weight: 700;
          font-family: monospace;
          color: #333;
        }

        .tx-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 10px;
        }

        .tx-details small {
          color: #666;
          font-size: 13px;
          word-break: break-all;
        }

        .approval-bar {
          width: 100%;
          height: 6px;
          background: #e0e0e0;
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .approval-progress {
          height: 100%;
          background: linear-gradient(90deg, #667eea, #1ed760);
          transition: width 0.3s ease;
        }

        .tx-actions {
          display: flex;
          gap: 8px;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }

        .btn-primary {
          background-color: #667eea;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #5568d3;
        }

        .btn-success {
          background-color: #4CAF50;
          color: white;
          flex: 1;
        }

        .btn-success:hover {
          background-color: #45a049;
        }

        .btn-execute {
          background-color: #1ed760;
          color: white;
          flex: 1;
        }

        .btn-execute:hover {
          background-color: #1aa34a;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .completed {
          display: inline-block;
          color: #1ed760;
          font-weight: 600;
          flex: 1;
          text-align: center;
        }
      `}</style>
    </div>
  )
}

export default GnosisSafeInterface
