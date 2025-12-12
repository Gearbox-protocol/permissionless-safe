import { Call } from "@/core/safe-tx";
import { ParsedCall } from "@gearbox-protocol/sdk";
import { GovernorContract } from "@gearbox-protocol/sdk/permissionless";
import { Address, Chain, PublicClient, Transport } from "viem";
import { usePublicClient } from "wagmi";

export function useDecodeGovernorCall(
  chainId: number,
  governor: Address,
  call: Call
): ParsedCall {
  const publicClient = usePublicClient({ chainId });
  const governorContract = new GovernorContract(
    governor,
    publicClient as PublicClient<Transport, Chain>
  );

  if (call.to.toLowerCase() !== governor.toLowerCase()) {
    return {
      chainId,
      target: call.to,
      contractType: "",
      label: "Unknown contract",
      functionName: `Unknown function: ${call.data}`,
      args: {},
    };
  }
  return governorContract.parseFunctionData(call.data);
}

export function useDecodeGovernorCalls(
  chainId: number,
  governor: Address,
  calls: Call[]
): ParsedCall[] {
  const publicClient = usePublicClient({ chainId });
  const governorContract = new GovernorContract(
    governor,
    publicClient as PublicClient<Transport, Chain>
  );

  return calls.map((call) => {
    if (call.to.toLowerCase() !== governor.toLowerCase()) {
      return {
        chainId,
        target: call.to,
        contractType: "",
        label: "Unknown contract",
        functionName: `Unknown function: ${call.data}`,
        args: {},
      };
    }
    return governorContract.parseFunctionData(call.data);
  });
}
