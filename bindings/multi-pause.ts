import { MultiPauseAbi } from "@/abi";
import { BaseContract, RawTx } from "@gearbox-protocol/sdk";
import { Chain, Transport, type Address, type PublicClient } from "viem";

const abi = MultiPauseAbi;

export class MultiPauseContract extends BaseContract<typeof abi> {
  constructor(addr: Address, client: PublicClient<Transport, Chain>) {
    super({ client }, { addr, abi, name: "Multipause" });
  }

  pauseAllContracts(): RawTx {
    return this.createRawTx({
      functionName: "pauseAllContracts",
    });
  }

  pauseMarket(pool: Address): RawTx {
    return this.createRawTx({
      functionName: "pauseMarket",
      args: [pool],
    });
  }

  pauseCreditSuite(creditManager: Address): RawTx {
    return this.createRawTx({
      functionName: "pauseCreditSuite",
      args: [creditManager],
    });
  }
}
