"use client";

import type { AgreementStatus, LegalMessage } from "@gearbox-protocol/auth-kit";
import { useAgreement, useBlockedRegion } from "@gearbox-protocol/auth-kit/react";
import { useAccount, useChainId, useWalletClient } from "wagmi";

const LEGAL_BASE_URL = "https://safe.gearbox.finance/legal";

const SAFE_LEGAL_MESSAGE: LegalMessage = {
  version: 3,
  text:
    `By signing this message, I agree to the Terms of Service (${LEGAL_BASE_URL}/terms-of-service) and acknowledge the Privacy Notice (${LEGAL_BASE_URL}/privacy-notice). I have read the Risk Disclosure Statement (${LEGAL_BASE_URL}/risk-disclosure) and I voluntarily assume all risks described in it.`,
};

export interface UseLegalAgreementReturn {
  /** Current agreement status */
  status: AgreementStatus | undefined;
  /** Whether check is in progress */
  isLoading: boolean;
  /** Whether signing is in progress */
  isSigning: boolean;
  /** Sign the legal agreement */
  signAgreement: () => Promise<void>;
  /** Whether user has v2 signature (needs re-sign) */
  hasV2Signature: boolean;
  /** Legal message text */
  legalMessage: string;
  /** Whether region is blocked */
  isBlocked: boolean;
  /** Whether region check is loading */
  isBlockedLoading: boolean;
  /** Whether user needs to sign agreement */
  needsAgreement: boolean;
  /** Whether user is allowed to use the app */
  isAllowed: boolean;
}

/**
 * Hook for legal agreement signing with Gearbox Protocol
 * Uses auth-kit with Gearbox endpoints and Permissionless-specific legal message
 */
export function useLegalAgreement(): UseLegalAgreementReturn {
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();

  const {
    status,
    isLoading,
    isSigning,
    signAgreement: signAgreementMutation,
    hasV2Signature,
    legalMessage,
  } = useAgreement({
    config: {
      legalMessage: SAFE_LEGAL_MESSAGE,
    },
    autoCheck: true,
  });

  const { isBlocked, isLoading: isBlockedLoading } = useBlockedRegion({});

  const signAgreement = async () => {
    if (!address || !walletClient || chainId === undefined) {
      return;
    }
    await signAgreementMutation({
      account: address,
      signer: walletClient,
      chainId,
    });
  };

  const needsAgreement = status === "NOT_SIGNED" || status === "AWAITING_SIGNATURE";
  const isAllowed = status === "ALLOWED";

  return {
    status,
    isLoading,
    isSigning,
    signAgreement,
    hasV2Signature,
    legalMessage,
    isBlocked,
    isBlockedLoading,
    needsAgreement,
    isAllowed,
  };
}

