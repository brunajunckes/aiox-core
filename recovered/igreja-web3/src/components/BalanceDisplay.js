import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
const BalanceDisplay = ({ walletBalance, safeBalance, account, safeAddress, }) => {
    const [ethPrice, setEthPrice] = useState(0);
    const [balances, setBalances] = useState([]);
    useEffect(() => {
        const fetchEthPrice = async () => {
            try {
                const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
                const data = await response.json();
                setEthPrice(data.ethereum?.usd || 0);
            }
            catch (err) {
                console.warn('Failed to fetch ETH price:', err);
                setEthPrice(0);
            }
        };
        fetchEthPrice();
    }, []);
    useEffect(() => {
        const newBalances = [];
        if (account) {
            newBalances.push({
                type: 'wallet',
                label: 'Carteira Pessoal',
                balance: walletBalance,
                icon: '👤',
                usdValue: ethPrice > 0
                    ? `$${(parseFloat(walletBalance) * ethPrice).toFixed(2)}`
                    : undefined,
            });
        }
        if (safeAddress) {
            newBalances.push({
                type: 'safe',
                label: 'Cofre Gnosis Safe',
                balance: safeBalance,
                icon: '🔐',
                usdValue: ethPrice > 0
                    ? `$${(parseFloat(safeBalance) * ethPrice).toFixed(2)}`
                    : undefined,
            });
        }
        setBalances(newBalances);
    }, [walletBalance, safeBalance, account, safeAddress, ethPrice]);
    if (balances.length === 0) {
        return (_jsx("div", { className: "balance-display-container", children: _jsx("div", { className: "empty-state", children: _jsx("p", { children: "Conecte uma carteira para visualizar os saldos" }) }) }));
    }
    return (_jsxs("div", { className: "balance-display-container", children: [_jsx("h2", { children: "Saldos" }), _jsx("div", { className: "balance-grid", children: balances.map(bal => (_jsxs("div", { className: `balance-card ${bal.type}`, children: [_jsxs("div", { className: "card-header", children: [_jsx("span", { className: "icon", children: bal.icon }), _jsx("h3", { children: bal.label })] }), _jsxs("div", { className: "card-body", children: [_jsxs("div", { className: "balance-amount", children: [_jsxs("span", { className: "eth-value", children: [parseFloat(bal.balance).toFixed(4), " ETH"] }), bal.usdValue && _jsx("span", { className: "usd-value", children: bal.usdValue })] }), bal.type === 'safe' && safeAddress && (_jsx("div", { className: "address-info", children: _jsxs("small", { children: ["Safe: ", safeAddress.slice(0, 10), "...", safeAddress.slice(-8)] }) }))] }), _jsx("div", { className: "card-footer", children: _jsx("small", { children: "Atualizado agora" }) })] }, bal.type))) }), _jsx("style", { children: `
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
      ` })] }));
};
export default BalanceDisplay;
//# sourceMappingURL=BalanceDisplay.js.map