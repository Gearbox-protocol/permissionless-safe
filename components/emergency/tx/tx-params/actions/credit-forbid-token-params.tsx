import { ForbidTokenAction } from "@/core/emergency-actions";
import { safeSymbol } from "@/utils/format";
import { OnchainSDK } from "@gearbox-protocol/sdk";
import { useMemo } from "react";
import { AddressParamsView } from "./address-param";

export function ForbidTokenParamsView({
  sdk,
  action,
}: {
  sdk: OnchainSDK;
  action: ForbidTokenAction;
}) {
  const creditSuite = useMemo(
    () => sdk.marketRegister.findCreditManager(action.params.creditManager),
    [sdk, action]
  );

  return (
    <div className="space-y-2">
      <AddressParamsView
        sdk={sdk}
        address={action.params.creditManager}
        title="creditManager"
        description={creditSuite.name}
      />
      <AddressParamsView
        sdk={sdk}
        address={action.params.token}
        title="token"
        description={safeSymbol(sdk.tokensMeta, action.params.token)}
      />
    </div>
  );
}
