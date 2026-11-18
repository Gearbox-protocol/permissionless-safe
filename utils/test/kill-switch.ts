import { iBytecodeRepositoryAbi } from "@gearbox-protocol/sdk/abi/310/iBytecodeRepository";
import { RawTx } from "@gearbox-protocol/sdk/onchain";
import {
  Addresses,
  BytecodeRepositoryContract,
  KILL_SWITCH_PROXY,
  KILL_SWITCH_PROXY_MINOR_VERSION,
} from "@gearbox-protocol/sdk/permissionless";
import {
  Account,
  Address,
  Chain,
  encodeFunctionData,
  Hex,
  parseEther,
  PublicClient,
  TestClient,
  Transport,
  WalletClient,
  zeroHash,
} from "viem";

/**
 * Hash of `KillSwitchProxy` bytecode (permissionless @ 12fec54), uploaded and audited in mainnet bytecode repository
 */
const KILL_SWITCH_PROXY_BYTECODE_HASH: Hex =
  "0xda04386097337332550e6486e198a3ddf4cc980d07975e70a67a6e07c95458ad";

export type ForkClient = PublicClient<Transport, Chain> & TestClient<"anvil">;

/**
 * Sends transaction on anvil fork from any address and throws if it reverts.
 * Code of the sender is removed, so that contracts (e.g. Safes and timelocks) can send transactions too
 */
export async function impersonateAndSendTx({
  client,
  walletClient,
  from,
  tx,
}: {
  client: ForkClient;
  walletClient: WalletClient<Transport, Chain>;
  from: Address | Account;
  tx: Pick<RawTx, "to" | "callData"> &
    Partial<Pick<RawTx, "value" | "description">>;
}) {
  const address = typeof from === "string" ? from : from.address;
  await client.setBalance({ address, value: parseEther("10") });
  if (typeof from === "string") {
    await client.setCode({ address, bytecode: "0x" });
    await client.impersonateAccount({ address });
  }

  const hash = await walletClient.sendTransaction({
    account: from,
    chain: walletClient.chain,
    to: tx.to,
    data: tx.callData,
    value: BigInt(tx.value || 0),
    gas: 29_000_000n,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(
      `tx ${hash} from ${address} to ${tx.to} reverted${tx.description ? `: ${tx.description}` : ""}`
    );
  }
  return receipt;
}

/**
 * Makes bytecode repository on anvil fork allow kill switch proxy, the way governance would:
 * allows already uploaded and audited bytecode as system contract on behalf of impersonated repository owner.
 *
 * Does nothing if some kill switch proxy bytecode is already allowed.
 */
export async function allowKillSwitchProxyOnFork({
  client,
  walletClient,
}: {
  client: ForkClient;
  walletClient: WalletClient<Transport, Chain>;
}): Promise<void> {
  const bcr = new BytecodeRepositoryContract(
    Addresses.BYTECODE_REPOSITORY,
    client
  );
  const allowed = await bcr.getAllowedBytecodeHash(
    KILL_SWITCH_PROXY,
    KILL_SWITCH_PROXY_MINOR_VERSION
  );
  if (allowed !== zeroHash) {
    return;
  }

  const owner = await client.readContract({
    address: bcr.address,
    abi: iBytecodeRepositoryAbi,
    functionName: "owner",
  });

  await impersonateAndSendTx({
    client,
    walletClient,
    from: owner,
    tx: {
      to: bcr.address,
      callData: encodeFunctionData({
        abi: iBytecodeRepositoryAbi,
        functionName: "allowSystemContract",
        args: [KILL_SWITCH_PROXY_BYTECODE_HASH],
      }),
    },
  });
}
