import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
const GnosisSafeInterface = ({ safeAddress, isConnected, onInitiateTx, onApproveTx, onExecuteTx, }) => {
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ to: '', value: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [transactions, setTransactions] = useState([
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
    ]);
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.to || !formData.value) {
            alert('Preencha todos os campos');
            return;
        }
        setIsSubmitting(true);
        try {
            if (onInitiateTx) {
                await onInitiateTx({ to: formData.to, value: formData.value });
            }
            const newTx = {
                id: `tx-${Date.now()}`,
                to: formData.to,
                value: formData.value,
                data: '0x',
                status: 'pending',
                approvals: 1,
                requiredApprovals: 5,
                timestamp: Date.now(),
            };
            setTransactions(prev => [newTx, ...prev]);
            setFormData({ to: '', value: '' });
            setShowForm(false);
        }
        catch (err) {
            console.error('Failed to initiate transaction:', err);
            alert('Erro ao iniciar transação. Verifique o console.');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleApprove = async (txId) => {
        try {
            if (onApproveTx) {
                await onApproveTx(txId);
            }
            setTransactions(prev => prev.map(tx => tx.id === txId
                ? {
                    ...tx,
                    approvals: Math.min(tx.approvals + 1, tx.requiredApprovals),
                    status: tx.approvals + 1 >= tx.requiredApprovals ? 'approved' : 'pending',
                }
                : tx));
        }
        catch (err) {
            console.error('Failed to approve transaction:', err);
            alert('Erro ao aprovar transação');
        }
    };
    const handleExecute = async (txId) => {
        try {
            if (onExecuteTx) {
                await onExecuteTx(txId);
            }
            setTransactions(prev => prev.map(tx => tx.id === txId ? { ...tx, status: 'executed' } : tx));
        }
        catch (err) {
            console.error('Failed to execute transaction:', err);
            alert('Erro ao executar transação');
        }
    };
    if (!isConnected) {
        return (_jsx("div", { className: "safe-interface-container", children: _jsx("div", { className: "not-connected", children: _jsx("p", { children: "Conecte uma carteira para gerenciar o Gnosis Safe" }) }) }));
    }
    return (_jsxs("div", { className: "safe-interface-container", children: [_jsxs("div", { className: "safe-panel", children: [_jsx("h2", { children: "Gnosis Safe Multi-Sig" }), safeAddress && (_jsx("div", { className: "safe-address", children: _jsxs("small", { children: ["Safe: ", safeAddress.slice(0, 10), "...", safeAddress.slice(-8)] }) })), _jsx("div", { className: "panel-controls", children: _jsx("button", { className: "btn btn-primary", onClick: () => setShowForm(!showForm), children: showForm ? 'Cancelar' : '+ Nova Transação' }) }), showForm && (_jsxs("form", { className: "transaction-form", onSubmit: handleSubmit, children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "to", children: "Endere\u00E7o Destinat\u00E1rio" }), _jsx("input", { id: "to", type: "text", name: "to", placeholder: "0x...", value: formData.to, onChange: handleInputChange, required: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "value", children: "Valor (ETH)" }), _jsx("input", { id: "value", type: "number", name: "value", placeholder: "0.5", step: "0.001", min: "0", value: formData.value, onChange: handleInputChange, required: true })] }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isSubmitting, children: isSubmitting ? 'Enviando...' : 'Propor Transação' })] })), _jsxs("div", { className: "transactions-list", children: [_jsx("h3", { children: "Transa\u00E7\u00F5es Pendentes" }), transactions.length === 0 ? (_jsx("p", { className: "empty-message", children: "Nenhuma transa\u00E7\u00E3o" })) : (_jsx("div", { className: "tx-items", children: transactions.map(tx => (_jsxs("div", { className: `tx-item ${tx.status}`, children: [_jsxs("div", { className: "tx-header", children: [_jsx("span", { className: "status-badge", children: tx.status }), _jsxs("span", { className: "tx-value", children: [tx.value, " ETH"] })] }), _jsxs("div", { className: "tx-details", children: [_jsxs("small", { children: ["Para: ", tx.to.slice(0, 12), "...", tx.to.slice(-8)] }), _jsxs("small", { children: ["Aprova\u00E7\u00F5es: ", tx.approvals, "/", tx.requiredApprovals] })] }), _jsx("div", { className: "approval-bar", children: _jsx("div", { className: "approval-progress", style: {
                                                    width: `${(tx.approvals / tx.requiredApprovals) * 100}%`,
                                                } }) }), tx.status === 'pending' && (_jsx("div", { className: "tx-actions", children: _jsx("button", { className: "btn btn-sm btn-success", onClick: () => handleApprove(tx.id), children: "Aprovar" }) })), tx.status === 'approved' && (_jsx("div", { className: "tx-actions", children: _jsx("button", { className: "btn btn-sm btn-execute", onClick: () => handleExecute(tx.id), children: "Executar" }) })), tx.status === 'executed' && (_jsx("div", { className: "tx-actions", children: _jsx("span", { className: "completed", children: "\u2713 Executada" }) }))] }, tx.id))) }))] })] }), _jsx("style", { children: `
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
      ` })] }));
};
export default GnosisSafeInterface;
//# sourceMappingURL=GnosisSafeInterface.js.map