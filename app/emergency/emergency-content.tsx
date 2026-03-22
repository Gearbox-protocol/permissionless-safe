"use client";

import { MarketConfiguratorList } from "@/components/emergency/market-configurator-list";
import { MarketConfiguratorView } from "@/components/emergency/market-configurator-view";
import { chains } from "@/config/wagmi";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Address, isAddress } from "viem";

export function EmergencyContent() {
  const searchParams = useSearchParams();

  const initialChainId = searchParams.get("chainId");
  const initialAddr = searchParams.get("mc");

  const [chainId, setChainId] = useState<number | undefined>(
    initialChainId && chains.find((c) => c.id === +initialChainId)
      ? +initialChainId
      : undefined
  );
  const [addr, setAddr] = useState<Address | undefined>(
    initialAddr && isAddress(initialAddr) ? initialAddr : undefined
  );

  if (!addr || !chainId) {
    return (
      <MarketConfiguratorList
        onSelect={(chainId: number, mc: Address) => {
          setChainId(chainId);
          setAddr(mc);
        }}
      />
    );
  }

  return (
    <MarketConfiguratorView
      chainId={chainId}
      address={addr}
      onClickBack={() => {
        setChainId(undefined);
        setAddr(undefined);
      }}
    />
  );
}

