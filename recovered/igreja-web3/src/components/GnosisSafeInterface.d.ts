import { FC } from 'react';
interface GnosisSafeInterfaceProps {
    safeAddress: string | null;
    isConnected: boolean;
    onInitiateTx?: (txData: {
        to: string;
        value: string;
    }) => Promise<void>;
    onApproveTx?: (txId: string) => Promise<void>;
    onExecuteTx?: (txId: string) => Promise<void>;
}
declare const GnosisSafeInterface: FC<GnosisSafeInterfaceProps>;
export default GnosisSafeInterface;
//# sourceMappingURL=GnosisSafeInterface.d.ts.map