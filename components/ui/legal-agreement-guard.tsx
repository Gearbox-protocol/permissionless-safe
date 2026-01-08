"use client";

import { useLegalAgreement } from "@/hooks/use-legal-agreement";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import {
  BlockedRegionDialog,
  createLegalAgreementConfig,
  LegalAgreementDialog,
} from "./legal-agreement-dialog";

interface LegalAgreementGuardProps {
  children: React.ReactNode;
}

/**
 * Guard component that shows legal agreement dialog when wallet is connected
 * but user hasn't signed the agreement yet.
 */
export function LegalAgreementGuard({ children }: LegalAgreementGuardProps) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const pathname = usePathname();

  const isLegalPage = pathname?.startsWith("/legal/");

  const {
    status,
    isLoading,
    isSigning,
    signAgreement,
    hasV2Signature,
    isBlocked,
    isBlockedLoading,
  } = useLegalAgreement();

  // Track if user has explicitly closed the dialog (disconnected)
  const [dialogDismissed, setDialogDismissed] = useState(false);

  // Reset dismissed state when address changes
  useEffect(() => {
    setDialogDismissed(false);
  }, [address]);

  const handleClose = useCallback(() => {
    // Disconnect wallet when user cancels the agreement
    disconnect();
    setDialogDismissed(true);
  }, [disconnect]);

  const handleSign = useCallback(async () => {
    await signAgreement();
  }, [signAgreement]);

  // Create legal agreement configuration for Permissionless Safe
  const legalAgreementConfig = useMemo(
    () =>
      createLegalAgreementConfig("Permissionless Safe", {
        termsOfService: "/legal/terms-of-service",
        privacyNotice: "/legal/privacy-notice",
        riskDisclosure: "/legal/risk-disclosure",
      }),
    [],
  );

  const shouldShowBlockedDialog =
    isConnected && !isBlockedLoading && isBlocked && !dialogDismissed && !isLegalPage;

  const shouldShowAgreementDialog =
    isConnected &&
    !isLoading &&
    !isBlockedLoading &&
    !isBlocked &&
    (status === "NOT_SIGNED" || status === "AWAITING_SIGNATURE") &&
    !dialogDismissed &&
    !isLegalPage;

  return (
    <>
      {children}

      <BlockedRegionDialog
        open={shouldShowBlockedDialog}
        onClose={handleClose}
        termsOfServiceLink="/legal/terms-of-service#6-wallets"
      />

      <LegalAgreementDialog
        open={shouldShowAgreementDialog}
        onClose={handleClose}
        onSign={handleSign}
        isSigning={isSigning}
        hasV2Signature={hasV2Signature}
        isAwaitingSignature={status === "AWAITING_SIGNATURE"}
        config={legalAgreementConfig}
      />
    </>
  );
}

