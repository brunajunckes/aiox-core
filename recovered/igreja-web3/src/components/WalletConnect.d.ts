import { FC } from 'react';
interface WalletConnectProps {
    account: string | null;
    balance: string;
    isConnecting: boolean;
    error: string | null;
    onConnect: () => Promise<void>;
    onDisconnect: () => void;
}
declare const WalletConnect: FC<WalletConnectProps>;
export default WalletConnect;
//# sourceMappingURL=WalletConnect.d.ts.map