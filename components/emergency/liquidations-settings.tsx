"use client";

import { buildEmergencyTxUrl } from "@/utils/emergency-url";
import { getLossPolicyState } from "@/utils/state";
import { Button } from "@gearbox-protocol/permissionless-ui";
import { MarketSuite } from "@gearbox-protocol/sdk";
import { AccessMode } from "@gearbox-protocol/sdk/permissionless";
import Link from "next/link";
import { useMemo } from "react";
import { Address } from "viem";

const ACCESS_MODE_TITLE: Record<AccessMode, string> = {
  [AccessMode.Forbidden]: "Nobody",
  [AccessMode.Permissioned]: "Whitelisted",
  [AccessMode.Permissionless]: "All",
};

export function LiquidationSettings({
  chainId,
  marketConfigurator,
  market,
  size = "sm",
}: {
  chainId: number;
  marketConfigurator: Address;
  market: MarketSuite;
  size?: "default" | "xs" | "sm" | "lg" | null;
}) {
  const lossPolicyState = useMemo(
    () => getLossPolicyState(market.state.lossPolicy.baseParams),
    [market],
  );

  return (
    <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3 w-full max-w-[450px]">
      {Object.values(AccessMode)
        .filter((m) => typeof m === "number")
        .map((accessMode) => {
          if (accessMode === lossPolicyState.state?.accessMode) {
            return (
              <Button
                size={size}
                variant={"outline"}
                disabled
                className="w-full border-success text-success disabled:opacity-100"
                key={`selected-${accessMode}`}
              >
                {ACCESS_MODE_TITLE[accessMode]}
              </Button>
            );
          }

          return (
            <Link
              key={`${chainId}-${marketConfigurator}-setAccessMode-${accessMode}`}
              href={buildEmergencyTxUrl(
                chainId,
                marketConfigurator,
                "LOSS_POLICY::setAccessMode",
                {
                  pool: market.pool.pool.address,
                  mode: accessMode,
                },
              )}
            >
              <Button size={size} variant={"outline"} className="w-full">
                {ACCESS_MODE_TITLE[accessMode]}
              </Button>
            </Link>
          );
        })}
    </div>
  );
}
