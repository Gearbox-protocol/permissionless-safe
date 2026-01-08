"use client";

import { LegalAgreementGuard } from "@/components/ui/legal-agreement-guard";
import { config } from "@/config/wagmi";
import SafeProvider from "@safe-global/safe-apps-react-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import React, { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { WagmiProvider } from "wagmi";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider mode="dark">
          <SafeProvider>
            <Toaster position="top-right" richColors theme="dark" closeButton />
            <LegalAgreementGuard>
              {children}
            </LegalAgreementGuard>
          </SafeProvider>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

