"use client";

import {
  AppLogoLink,
  Header,
} from "@gearbox-protocol/permissionless-ui";
import { ConnectKitButton } from "connectkit";
import { useAccount } from "wagmi";
import { Navigation, NavigationMobile } from "./navigation";

export default function HeaderLayout() {
  const { chain, isConnected } = useAccount();

  return (
    <Header
      logo={
        <AppLogoLink appName="Safe" />
      }
      navigation={<Navigation />}
      mobileMenuContent={<NavigationMobile />}
      actions={<>
        {chain && isConnected ? (
          <div className="flex items-center gap-2 px-3 py-2 h-[40px] bg-card rounded-lg border border-border">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span className="text-sm text-foreground">{chain.name}</span>
          </div>
        ) : (
          <div className="w-24 h-8" />
        )}
        <ConnectKitButton mode="dark" />
      </>
      }
    />
  );
}
