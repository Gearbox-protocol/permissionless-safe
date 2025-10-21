"use client";

import { useSafeAddress, useSafeParams } from "@/hooks";
import { getReserveMultisigBatch } from "@/utils/multisend";
import { executedSafeTxs } from "@/utils/tx-status";
import { SafeTx } from "@gearbox-protocol/sdk/permissionless";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Address, Hex } from "viem";
import { usePublicClient } from "wagmi";

export function useExecutedTxs({
  chainId,
  instanceManager,
  createdAtBlock,
}: {
  chainId?: number;
  instanceManager?: Address;
  createdAtBlock?: number;
}): {
  executedHashes?: {
    safeTxHash: Hex;
    txHash: Hex;
  }[];
  isLoading: boolean;
  error: Error | null;
} {
  const publicClient = usePublicClient({ chainId });

  // persist minimal createdAtBlock across updates
  const createdAtRef = useRef<number | undefined>(createdAtBlock);
  useEffect(() => {
    if (createdAtBlock !== undefined) {
      if (
        createdAtRef.current === undefined ||
        createdAtBlock < (createdAtRef.current as number)
      ) {
        createdAtRef.current = createdAtBlock;
      }
    }
  }, [createdAtBlock]);
  const effectiveCreatedAtBlock = createdAtRef.current;

  const {
    safe,
    isLoading: isLoadingSafe,
    error: errorSafe,
  } = useSafeAddress(chainId, instanceManager);

  const {
    data: executedHashes,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["executed-txs", effectiveCreatedAtBlock],
    queryFn: async () => {
      if (!safe || !publicClient) return;

      return (
        await executedSafeTxs({
          publicClient,
          safe,
          createdAtBlock: effectiveCreatedAtBlock,
        })
      ).map(({ safeTxHash, txHash }) => ({
        safeTxHash: safeTxHash.toLowerCase() as Hex,
        txHash: txHash.toLowerCase() as Hex,
      }));
    },
    enabled: !!publicClient && !!safe,
    retry: 3,
  });

  return {
    executedHashes,
    isLoading: isLoadingSafe || isLoading,
    error: errorSafe || error,
  };
}

export function useInstanceTransactionExecuted({
  cid,
  chainId,
  batches,
  instanceManager,
  createdAtBlock,
}: {
  cid: string;
  chainId?: number;
  instanceManager?: Address;
  batches?: SafeTx[][];
  createdAtBlock?: number;
}): {
  isExecuted?: boolean;
  nonce?: number;
  txHash?: Hex;
  isLoading: boolean;
  error: Error | null;
} {
  const publicClient = usePublicClient({ chainId });

  const {
    safe,
    isLoading: isLoadingSafe,
    error: errorSafe,
  } = useSafeAddress(chainId, instanceManager);

  const {
    nonce,
    isLoading: isLoadingNonce,
    error: errorNonce,
  } = useSafeParams(chainId, safe);

  const {
    executedHashes,
    isLoading: isLoadingHashes,
    error: errorHashes,
  } = useExecutedTxs({
    chainId,
    instanceManager,
    createdAtBlock,
  });

  const {
    data: status,
    isLoading: isLoadingStatus,
    error: errorStatus,
  } = useQuery({
    queryKey: ["is-executed", cid],
    queryFn: async () => {
      if (!safe || !publicClient || !executedHashes || nonce === undefined)
        return;

      const nonces = executedHashes.map(
        (_, index) => Number(nonce) - index - 1
      );
      const preparedTxMap = await Promise.all(
        nonces.map((nonce) =>
          getReserveMultisigBatch({
            type: "queue",
            client: publicClient,
            safeAddress: safe,
            batch: batches![0] as SafeTx[],
            nonce: nonce,
          })
        )
      );

      for (const [index, tx] of preparedTxMap.entries()) {
        const executedTx = executedHashes.find(
          ({ safeTxHash }) => safeTxHash.toLowerCase() === tx.hash.toLowerCase()
        );

        if (executedTx) {
          return {
            isExecuted: true,
            nonce: nonces[index],
            txHash: executedTx.txHash,
          };
        }
      }

      return { isExecuted: false };
    },
    enabled:
      !!publicClient && !!safe && !!executedHashes && nonce !== undefined,
    retry: 3,
  });

  return {
    isExecuted: status?.isExecuted,
    nonce: status?.nonce,
    txHash: status?.txHash,
    isLoading:
      isLoadingSafe || isLoadingNonce || isLoadingHashes || isLoadingStatus,
    error: errorSafe || errorNonce || errorHashes || errorStatus,
  };
}

export function useInstanceTransactionsExecuted({
  cids,
  chainId,
  batches,
  instanceManager,
  createdAtBlock,
}: {
  cids: string[];
  chainId?: number;
  instanceManager?: Address;
  batches?: Array<SafeTx[][]>;
  createdAtBlock?: Array<number | undefined>;
}): {
  data?:
    | {
        isExecuted: true;
        nonce: number;
        txHash: Hex;
      }
    | {
        isExecuted: false;
        nonce?: undefined;
      };
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const publicClient = usePublicClient({ chainId });

  const {
    safe,
    isLoading: isLoadingSafe,
    error: errorSafe,
  } = useSafeAddress(chainId, instanceManager);

  const {
    nonce,
    isLoading: isLoadingNonce,
    error: errorNonce,
  } = useSafeParams(chainId, safe);

  const minCreatedAtBlock = createdAtBlock?.reduce<number | undefined>(
    (min, cur) =>
      min === undefined ? cur : cur ? (cur < min ? cur : min) : min,
    undefined
  );

  const {
    executedHashes,
    isLoading: isLoadingHashes,
    error: errorHashes,
  } = useExecutedTxs({
    chainId,
    instanceManager,
    createdAtBlock: minCreatedAtBlock,
  });

  const result = useQueries({
    queries: cids.map((cid, idx) => ({
      queryKey: ["is-executed", cid],
      queryFn: async () => {
        if (!safe || !publicClient || !executedHashes || nonce === undefined)
          return;

        if (!cid) return;

        const currentFirstBatch = batches?.[idx]?.[0] as SafeTx[] | undefined;
        if (!currentFirstBatch) return;

        const nonces = executedHashes.map(
          (_, index) => Number(nonce) - index - 1
        );
        const preparedTxMap = await Promise.all(
          nonces.map((nonce) =>
            getReserveMultisigBatch({
              type: "queue",
              client: publicClient,
              safeAddress: safe,
              batch: currentFirstBatch,
              nonce: nonce,
            })
          )
        );

        for (const [index, tx] of preparedTxMap.entries()) {
          const executedTx = executedHashes.find(
            ({ safeTxHash }) =>
              safeTxHash.toLowerCase() === tx.hash.toLowerCase()
          );
          if (executedTx) {
            return {
              isExecuted: true,
              nonce: nonces[index],
              txHash: executedTx.txHash,
            };
          }
        }

        return { isExecuted: false };
      },

      enabled:
        !!cid &&
        !!publicClient &&
        !!safe &&
        !!executedHashes &&
        nonce !== undefined,
      retry: 3,
    })),
  });

  return {
    data: result.map(({ data }) => data) as unknown as
      | {
          isExecuted: true;
          nonce: number;
          txHash: Hex;
        }
      | {
          isExecuted: false;
          nonce?: undefined;
        }
      | undefined,
    isLoading:
      isLoadingSafe ||
      isLoadingNonce ||
      isLoadingHashes ||
      result.some(({ isLoading }) => isLoading),
    error:
      errorSafe ||
      errorNonce ||
      errorHashes ||
      result.find(({ error }) => error)?.error ||
      null,
    refetch: async () => {
      await Promise.all(result.map((r) => r.refetch()));
    },
  };
}
