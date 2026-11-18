import { ExtendedSignedTx, ParsedSignedTx } from "@/core/safe-tx";
import { AP_PRICE_FEED_COMPRESSOR } from "@gearbox-protocol/sdk/onchain";
import {
  Addresses,
  AddressProviderContract,
  getUpdatablePriceFeeds,
} from "@gearbox-protocol/sdk/permissionless";
import { useQuery } from "@tanstack/react-query";
import { Address } from "viem";
import { usePublicClient } from "wagmi";
import { useSDK } from "../use-sdk";

function useGetUpdatableFeeds({
  cid,
  chainId,
  index,
  tx,
}: {
  cid: string;
  chainId: number;
  index: number;
  tx: ExtendedSignedTx;
}) {
  const { data: sdk } = useSDK({ chainId });
  const publicClient = usePublicClient({ chainId });

  return useQuery({
    queryKey: [cid, index],
    queryFn: async () => {
      if (!publicClient || !sdk) return;
      if (!tx.updatableFeeds) return [];

      const addressProvider = new AddressProviderContract(
        Addresses.ADDRESS_PROVIDER,
        publicClient
      );

      const pfCompressor = await addressProvider.getAddressOrRevert(
        AP_PRICE_FEED_COMPRESSOR,
        310n
      );

      return (
        await getUpdatablePriceFeeds({
          sdk,
          client: publicClient,
          pfCompressor,
          priceFeeds: tx.updatableFeeds,
        })
      ).map((feed) => feed.address);
    },
    enabled: !!publicClient || !!sdk,
    retry: 3,
  });
}

export function useGetGovernorUpdatableFeeds({
  tx,
  ...rest
}: {
  governor: Address;
  tx: ParsedSignedTx;
  cid: string;
  chainId: number;
  index: number;
}) {
  return useGetUpdatableFeeds({ tx, ...rest });
}

export function useGetInstanceUpdatableFeeds({
  tx,
  ...rest
}: {
  instanceManager: Address;
  tx: ExtendedSignedTx;
  cid: string;
  chainId: number;
  index: number;
}) {
  return useGetUpdatableFeeds({ tx, ...rest });
}
