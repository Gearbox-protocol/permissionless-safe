import { ParsedSignedTx } from "@/core/safe-tx";
import { TimelockTxStatus } from "@/utils/tx-status";
import { Address } from "viem";
import { useBaseSimulateTx } from "./use-base-simulate-tx";

export function useSimulateGovernorTx(
  chainId: number,
  safeAddress: Address,
  governor: Address,
  tx: ParsedSignedTx
) {
  const isQueueTx = tx.status === TimelockTxStatus.NotFound;

  // For queue transactions, we don't need price feeds
  const effectivePriceFeeds = isQueueTx ? [] : (tx.updatableFeeds ?? []);

  return useBaseSimulateTx({
    chainId,
    safeAddress,
    tx,
    priceFeeds: effectivePriceFeeds,
    useMulticall3ForPriceUpdate: true,
  });
}
