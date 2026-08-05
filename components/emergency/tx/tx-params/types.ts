import { EmergencyTx } from "@/core/emergency-actions";
import { AdminInfo } from "@/hooks";
import { OnchainSDK } from "@gearbox-protocol/sdk";

export interface EmergencyTxProps {
  chainId: number;
  sdk: OnchainSDK;
  emergencyTx: EmergencyTx;
  adminInfo: AdminInfo;
}
