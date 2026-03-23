"use client";

import { EmergencyActionView } from "@/components/emergency/tx/emergency-action-view";
import { SkeletonStacks } from "@/components/ui/skeleton";
import { chains } from "@/config/wagmi";
import {
  EmergencyActions,
  validateEmergencyAction,
} from "@/core/emergency-actions";
import { Container, PageLayout } from "@gearbox-protocol/permissionless-ui";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Address, isAddress } from "viem";

export function EmergencyTxContent() {
  const searchParams = useSearchParams();

  const { chainId, addr, action, isError } = useMemo(() => {
    let chainId: number | undefined;
    let addr: Address | undefined;
    let action: EmergencyActions | undefined;
    let isError = false;

    const chainIdParam = searchParams.get("chainId");
    const address = searchParams.get("mc");
    const actionType = searchParams.get("action");
    const txParams = searchParams.get("params");

    if (chainIdParam && !!chains.find((c) => c.id === +chainIdParam)) {
      chainId = +chainIdParam;
    } else {
      isError = true;
    }

    if (address && isAddress(address)) {
      addr = address;
    } else {
      isError = true;
    }

    if (actionType && txParams) {
      try {
        action = validateEmergencyAction({
          type: actionType,
          params: JSON.parse(txParams),
        });
      } catch {
        isError = true;
      }
    } else {
      isError = true;
    }

    return { chainId, addr, action, isError };
  }, [searchParams]);

  if (isError) return <div>Error: invalid tx URL</div>;

  if (!addr || !chainId || !action) {
    return (
      <PageLayout title={"Emergency tx"}>
        <Container>
          <SkeletonStacks />
        </Container>
      </PageLayout>
    );
  }

  return (
    <EmergencyActionView
      chainId={chainId}
      marketConfigurator={addr}
      action={action}
    />
  );
}


