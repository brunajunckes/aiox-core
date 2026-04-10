import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const WalletConnect = ({ account, balance, isConnecting, error, onConnect, onDisconnect, }) => {
    const displayAddress = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not connected';
    return (_jsxs("div", { className: "wallet-connect-container", children: [_jsxs("div", { className: "wallet-card", children: [_jsx("h2", { children: "Conectar Carteira" }), error && _jsx("div", { className: "error-alert", children: error }), account ? (_jsxs("div", { className: "wallet-info", children: [_jsxs("div", { className: "info-row", children: [_jsx("span", { className: "label", children: "Endere\u00E7o:" }), _jsx("span", { className: "value", children: displayAddress }), _jsx("button", { className: "copy-button", onClick: () => navigator.clipboard.writeText(account), title: "Copiar endere\u00E7o completo", children: "\uD83D\uDCCB" })] }), _jsxs("div", { className: "info-row", children: [_jsx("span", { className: "label", children: "Saldo:" }), _jsxs("span", { className: "value", children: [parseFloat(balance).toFixed(4), " ETH"] })] }), _jsx("button", { className: "btn btn-secondary", onClick: onDisconnect, children: "Desconectar Carteira" })] })) : (_jsxs("div", { className: "wallet-prompt", children: [_jsx("p", { children: "Conecte uma carteira Web3 para come\u00E7ar" }), _jsx("button", { className: "btn btn-primary", onClick: onConnect, disabled: isConnecting, children: isConnecting ? 'Conectando...' : 'Conectar MetaMask' })] }))] }), _jsx("style", { children: `
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
      ` })] }));
};
export default WalletConnect;
//# sourceMappingURL=WalletConnect.js.map