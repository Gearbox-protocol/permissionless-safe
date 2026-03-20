"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@gearbox-protocol/permissionless-ui";
import { Info, Play, Wallet } from "lucide-react";

export function TransactionInfoDialog({
  isConfirmButton,
  canSend,
}: {
  isConfirmButton: boolean;
  canSend?: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="mx-[-12px]"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isConfirmButton ? "Confirm Transaction" : "Execute Transaction"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isConfirmButton ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                The Confirm button approves the transaction hash on-chain:
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center min-w-8 w-8 h-8 rounded-full bg-primary/20 border border-primary/30 mt-0.5">
                    <Wallet className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">
                      On-Chain Approval
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Approve the transaction hash on-chain to add your
                      signature
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-muted rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> This adds your approval to the Safe.
                  Once enough signers have confirmed, the transaction can be
                  executed.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {canSend
                  ? "The Execute button directly sends the transaction:"
                  : "The Execute button triggers a 2-step process:"}
              </p>

              <div className="space-y-3">
                {!canSend && (
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center min-w-8 w-8 h-8 rounded-full bg-primary/20 border border-primary/30 mt-0.5">
                      <Wallet className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">
                        1. Off-Chain Signature
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Sign the transaction hash off-chain in your wallet
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center min-w-8 w-8 h-8 rounded-full bg-success/20 border border-success/30 mt-0.5">
                    <Play className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">
                      {canSend
                        ? "Multicall3 Execution"
                        : "2. Multicall3 Execution"}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Send a single Multicall3 transaction that pulls price
                      updates and executes the Safe batch
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-muted rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong>{" "}
                  {canSend
                    ? "Enough signatures have been collected. This directly executes with the most current price data."
                    : "This ensures your transaction executes with the most current price data, preventing potential issues with outdated feeds."}
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
