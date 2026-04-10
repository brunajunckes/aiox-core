import { BrowserProvider } from 'ethers';
export declare const useWeb3: () => {
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    getSafeInfo: (safeAddress: string) => Promise<{
        address: string;
        balance: string;
    } | null>;
    signMessage: (message: string) => Promise<string | null>;
    provider: BrowserProvider | null;
    account: string | null;
    balance: string;
    isConnecting: boolean;
    error: string | null;
    safeAddress: string | null;
    safeBalance: string;
};
declare global {
    interface Window {
        ethereum: unknown;
    }
}
//# sourceMappingURL=useWeb3.d.ts.map