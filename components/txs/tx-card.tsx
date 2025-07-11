import { Card } from "@/components/ui/card";
import { ParsedSignedTx } from "@/core/safe-tx";
import { MULTISEND_ADDRESS } from "@/utils/constant";
import { shortenHash } from "@/utils/format";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Address } from "viem";
import { ProposalCall } from "./proposal-call";
import { ProposalSignatures } from "./proposal-signatures";
import { ButtonTx } from "./tx-button";

interface TransactionCardProps {
  cid: string;
  tx: ParsedSignedTx;
  safeAddress: Address;
  governor: Address;
  threshold: number;
}

export function TransactionCard({
  cid,
  tx,
  safeAddress,
  governor,
  threshold,
}: TransactionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="flex flex-col">
      <div
        className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-900/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <span className="text-lg text-gray-400 w-30">
            #{tx.nonce.toString()}
          </span>
          <div className="flex items-center">
            <span className="text-lg text-white">
              {tx.to.toLowerCase() === MULTISEND_ADDRESS.toLowerCase()
                ? "Multisend"
                : tx.to}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">{tx.calls.length} actions</span>
          <span className="text-gray-400">
            {tx.signedBy.length} / {Number(threshold)}
          </span>

          <ButtonTx tx={tx} safeAddress={safeAddress} cid={cid} />

          <span className="text-gray-400 transform transition-transform">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </span>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="border-t border-gray-800 bg-gray-900/30 p-4 ">
          <div className="grid grid-cols-[1fr_300px] gap-12">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="min-w-[140px] text-gray-200">Hash:</span>
                  <code className="flex items-center gap-2 text-gray-100">
                    {shortenHash(tx.hash)}

                    <button
                      className="text-gray-400 hover:text-white"
                      onClick={() => {
                        navigator.clipboard.writeText(tx.hash);
                        toast.success("Address copied to clipboard");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </code>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <div className="mb-4 text-gray-200">Calls:</div>
                {tx.calls.map((call, index) => (
                  <ProposalCall
                    governor={governor}
                    key={`call-${index}`}
                    index={index + 1}
                    call={call}
                  />
                ))}
              </div>
            </div>

            <div className="border-l border-gray-800 pl-8">
              <ProposalSignatures
                signers={tx.signedBy || []}
                safeAddress={safeAddress}
                status={tx.status}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
