"use client";

import { safeAbi } from "@/bindings/generated";
import { ParsedSignedTx, SignedTx } from "@/core/safe-tx";
import { useGovernanceAddresses, useIpfsData, useSafeParams } from "@/hooks";
import {
  decodeMultisendTransactions,
  getReserveMultisigBatch,
} from "@/utils/multisend";
import { getTxStatus, TimelockTxStatus } from "@/utils/tx-status";
import { SafeTx } from "@gearbox-protocol/permissionless";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Address, encodeAbiParameters, Hex, keccak256 } from "viem";
import { usePublicClient } from "wagmi";

export function useCurrentTransactions(cid: string): {
  txs: ParsedSignedTx[];
  safe?: Address;
  governor?: Address;
  isLoading: boolean;
  error: Error | null;
  refetchSigs: () => Promise<unknown>;
} {
  const publicClient = usePublicClient();

  const {
    marketConfigurator,
    eta,
    queueBatches,
    createdAtBlock,
    isLoading: isLoadingIpfsData,
    error: errorIpfsData,
  } = useIpfsData(cid);

  const {
    safeAddress,
    timelockAddress,
    governorAddress,
    isLoading: isLoadingAddresses,
    error: errorAddresses,
  } = useGovernanceAddresses(marketConfigurator);

  const statuses = useQueries({
    queries: (queueBatches ?? []).map((batch, index) => ({
      queryKey: ["batch-status", cid, index],
      queryFn: async () => {
        if (!publicClient || !safeAddress || !timelockAddress) return;

        if (
          batch.length < 2 ||
          batch[0].contractMethod.name !== "startBatch" ||
          batch[1].contractMethod.name !== "queueTransaction"
        ) {
          return {
            status: TimelockTxStatus.NotFound,
            blockNumber: -1,
          };
        }

        const txEta = Number(batch[0].contractInputsValues.eta);
        if (eta !== undefined && eta !== txEta) {
          throw new Error("Invalid ETA");
        }

        const txHash = keccak256(
          encodeAbiParameters(
            [
              { type: "address", name: "target" },
              { type: "uint", name: "value" },
              { type: "string", name: "signature" },
              { type: "bytes", name: "data" },
              { type: "uint", name: "eta" },
            ],
            [
              batch[1].contractInputsValues.target as Address,
              BigInt(Number(batch[1].contractInputsValues.value)),
              batch[1].contractInputsValues.signature as string,
              batch[1].contractInputsValues.data as Hex,
              BigInt(Number(batch[1].contractInputsValues.eta)),
            ]
          )
        );

        return await getTxStatus({
          publicClient,
          timelock: timelockAddress,
          txHash,
          eta: txEta,
          createdAtBlock,
        });
      },

      enabled:
        !!queueBatches && !!safeAddress && !!publicClient && !!timelockAddress,
      retry: 3,
    })),
  });

  const { nonce, signers } = useSafeParams(safeAddress);

  const {
    data: preparedTxs,
    isLoading: isLoadingPreparedTxs,
    error: errorPreparedTxs,
  } = useQuery({
    queryKey: ["prepared-batches", cid],
    queryFn: async () => {
      if (
        !publicClient ||
        !safeAddress ||
        nonce === undefined ||
        !statuses.every((s) => s.data !== undefined)
      )
        return;

      const allBatchesQueued = statuses.every(
        ({ data }) => data?.status !== TimelockTxStatus.NotFound
      );

      const startIndex = statuses.findIndex(
        ({ data }) =>
          data?.status ===
          (allBatchesQueued
            ? TimelockTxStatus.Ready
            : TimelockTxStatus.NotFound)
      );

      return await Promise.all(
        (queueBatches ?? []).map((batch, index) =>
          getReserveMultisigBatch({
            type: allBatchesQueued ? "execute" : "queue",
            client: publicClient,
            safeAddress,
            batch: batch as SafeTx[],
            nonce:
              startIndex === -1
                ? Number(nonce) + index
                : Number(nonce) + index - startIndex,
          })
        )
      );
    },
    enabled:
      !!cid &&
      !!publicClient &&
      !!safeAddress &&
      nonce !== undefined &&
      statuses.every((s) => s.data !== undefined),
    retry: 3,
  });

  const {
    data: txs,
    isLoading: isLoadingTxs,
    error: errorTxs,
    refetch,
  } = useQuery({
    queryKey: ["current-transactions", cid],
    queryFn: async () => {
      if (
        !safeAddress ||
        !publicClient ||
        !signers ||
        !preparedTxs ||
        nonce === undefined
      )
        return;

      const readyTxs: SignedTx[] = [];

      for (const tx of preparedTxs) {
        const signedBy = await Promise.all(
          signers.map((signer) =>
            publicClient.readContract({
              address: safeAddress,
              abi: safeAbi,
              functionName: "approvedHashes",
              args: [signer, tx.hash as Hex],
            })
          )
        );
        readyTxs.push({
          ...tx,
          to: tx.to as Address,
          value: BigInt(tx.value),
          data: tx.data as Hex,
          operation: tx.operation,
          safeTxGas: BigInt(tx.safeTxGas),
          baseGas: BigInt(tx.baseGas),
          gasPrice: BigInt(tx.gasPrice),
          gasToken: tx.gasToken as Address,
          refundReceiver: tx.refundReceiver as Address,
          nonce: BigInt(tx.nonce),
          hash: tx.hash as Hex,
          signedBy: [
            ...(signers.filter((_, index) => signedBy[index] > 0) as Address[]),
          ],
          calls: decodeMultisendTransactions(tx.data as Hex),
        });
      }

      return readyTxs;
    },
    enabled:
      !!cid &&
      !!publicClient &&
      !!signers &&
      !!safeAddress &&
      !!preparedTxs &&
      nonce !== undefined,
    retry: 3,
  });

  return {
    txs:
      !!txs &&
      !!statuses &&
      txs.length === statuses.length &&
      statuses.every((s) => s.data !== undefined)
        ? txs.map((tx, index) => ({
            ...tx,
            status: statuses[index].data?.status ?? TimelockTxStatus.NotFound,
            queueBlock: statuses[index].data?.blockNumber ?? -1,
            eta,
            fetchStatus: statuses[index].refetch,
          }))
        : [],
    safe: safeAddress,
    governor: governorAddress,
    isLoading:
      isLoadingTxs ||
      isLoadingIpfsData ||
      isLoadingAddresses ||
      isLoadingPreparedTxs ||
      !!statuses.find(({ isLoading }) => !!isLoading),
    error: (errorTxs ||
      errorIpfsData ||
      errorAddresses ||
      errorPreparedTxs ||
      statuses.find(({ error }) => !!error)) as Error | null,
    refetchSigs: refetch,
  };
}
