import { useState, useCallback } from 'react';
import { BrowserProvider, formatEther } from 'ethers';
const INITIAL_STATE = {
    provider: null,
    account: null,
    balance: '0',
    isConnecting: false,
    error: null,
    safeAddress: null,
    safeBalance: '0',
};
export const useWeb3 = () => {
    const [state, setState] = useState(INITIAL_STATE);
    const connectWallet = useCallback(async () => {
        setState(prev => ({ ...prev, isConnecting: true, error: null }));
        try {
            if (!window.ethereum) {
                throw new Error('MetaMask or WalletConnect not detected. Please install a Web3 wallet.');
            }
            const provider = new BrowserProvider(window.ethereum);
            const accounts = await provider.send('eth_requestAccounts', []);
            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found. Please authorize wallet connection.');
            }
            const account = accounts[0];
            const balanceWei = await provider.getBalance(account);
            const balance = formatEther(balanceWei);
            setState(prev => ({
                ...prev,
                provider,
                account,
                balance,
                isConnecting: false,
            }));
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to connect wallet';
            setState(prev => ({
                ...prev,
                error: errorMsg,
                isConnecting: false,
            }));
            console.error('Wallet connection error:', err);
        }
    }, []);
    const disconnectWallet = useCallback(() => {
        setState(INITIAL_STATE);
    }, []);
    const getSafeInfo = useCallback(async (safeAddress) => {
        if (!state.provider) {
            setState(prev => ({
                ...prev,
                error: 'Provider not connected',
            }));
            return null;
        }
        try {
            // Validate safe address format
            if (!safeAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
                throw new Error('Invalid safe address format');
            }
            const safeBalance = await state.provider.getBalance(safeAddress);
            const safeBal = formatEther(safeBalance);
            setState(prev => ({
                ...prev,
                safeAddress,
                safeBalance: safeBal,
            }));
            return {
                address: safeAddress,
                balance: safeBal,
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to fetch Safe info';
            setState(prev => ({
                ...prev,
                error: errorMsg,
            }));
            console.error('Safe info error:', err);
            return null;
        }
    }, [state.provider]);
    const signMessage = useCallback(async (message) => {
        if (!state.provider || !state.account) {
            setState(prev => ({
                ...prev,
                error: 'Wallet not connected',
            }));
            return null;
        }
        try {
            const signer = await state.provider.getSigner();
            const signature = await signer.signMessage(message);
            return signature;
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to sign message';
            setState(prev => ({
                ...prev,
                error: errorMsg,
            }));
            console.error('Sign message error:', err);
            return null;
        }
    }, [state.provider, state.account]);
    return {
        ...state,
        connectWallet,
        disconnectWallet,
        getSafeInfo,
        signMessage,
    };
};
//# sourceMappingURL=useWeb3.js.map