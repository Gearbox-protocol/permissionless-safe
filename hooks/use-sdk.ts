import { SDK_GAS_LIMIT_BY_CHAIN } from "@/config/wagmi";
import { getNetworkType, OnchainSDK } from "@gearbox-protocol/sdk";
import { useQuery } from "@tanstack/react-query";
import { Address } from "viem";
import { usePublicClient } from "wagmi";

export function useSDK({
  chainId,
  configurators,
}: {
  chainId?: number;
  configurators?: Address[];
}) {
  const publicClient = usePublicClient({
    chainId,
  });

  chainId = chainId ?? publicClient?.chain.id;

  return useQuery({
    queryKey: [
      "sdk",
      chainId,
      (configurators ?? [])
        .sort((a, b) => a.localeCompare(b))
        .map((c) => c.toLowerCase()),
    ],
    queryFn: async () => {
      if (!publicClient) return null;

      const sdk = new OnchainSDK(
        getNetworkType(chainId!),
        { rpcURLs: [publicClient.transport.url!] },
        { gasLimit: SDK_GAS_LIMIT_BY_CHAIN[chainId!] },
      );

      await sdk.attach({ marketConfigurators: configurators ?? [] });

      return sdk;
    },
    enabled: !!publicClient,
  });
}
