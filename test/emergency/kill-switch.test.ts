import {
  emergencyActionsData,
  emergencyActionsMap,
  EmergencyActions,
  EmergencyActionsType,
  getEmergencyTx,
} from "@/core/emergency-actions";
import { getLossPolicyState } from "@/utils/state";
import {
  allowKillSwitchProxyOnFork,
  ForkClient,
  impersonateAndSendTx,
} from "@/utils/test/kill-switch";
import {
  iCreditConfiguratorV310Abi,
  iCreditFacadeV310Abi,
  iCreditManagerV310Abi,
  iMarketConfiguratorV310Abi,
  iPoolQuotaKeeperV310Abi,
  iPoolV310Abi,
} from "@gearbox-protocol/sdk/abi/310/generated";
import { iKillSwitchProxyAbi } from "@gearbox-protocol/sdk/abi/310/iKillSwitchProxy";
import { detectChain } from "@gearbox-protocol/sdk/dev";
import {
  getNetworkType,
  MarketSuite,
  OnchainSDK,
  RawTx,
} from "@gearbox-protocol/sdk/onchain";
import {
  AccessMode,
  Addresses,
  BytecodeRepositoryContract,
  getPriceUpdateTx,
  KillSwitchProxyContract,
  killSwitchProxySalt,
  MarketConfiguratorContract,
  PriceFeedStoreContract,
} from "@gearbox-protocol/sdk/permissionless";
import { config as dotenvConfig } from "dotenv";
import {
  Abi,
  Address,
  BaseError,
  Chain,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  getAddress,
  http,
  isAddress,
  isAddressEqual,
  parseAbi,
  Quantity,
  testActions,
  Transport,
  WalletClient,
  zeroAddress,
} from "viem";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

dotenvConfig({ path: ".env.local" });

const ANVIL_RPC = process.env.ANVIL_RPC_URL || "http://127.0.0.1:8545";
const RPC = process.env.NEXT_PUBLIC_RPC_URL;
const AP = process.env.NEXT_PUBLIC_ADDRESS_PROVIDER;

const KILL_SWITCH_OWNER = getAddress(
  "0x00000000000000000000000000000000000c0de0"
);
const STRANGER = getAddress("0x0000000000000000000000000000000000005742");

// multipause actions are executed by pausable admins, not by emergency admin;
// pauses go last, so that they can't affect other actions on the same contracts
const EMERGENCY_ADMIN_ACTIONS = emergencyActionsData
  .map(({ type }) => type)
  .filter((type) => !type.startsWith("MULTI_PAUSE::"))
  .sort(
    (a, b) => Number(a.endsWith("::pause")) - Number(b.endsWith("::pause"))
  );

// errors of market configurator bubble up through `proxyCall`
const routingAbi: Abi = [...iKillSwitchProxyAbi, ...iMarketConfiguratorV310Abi];

const pausableAbi = parseAbi(["function paused() view returns (bool)"]);
const aliasedLossPolicyAbi = parseAbi([
  "function accessMode() view returns (uint8)",
  "function checksEnabled() view returns (bool)",
]);

interface EmergencyCase {
  action: EmergencyActions;
  /**
   * Permissionless transactions to send before the emergency one, e.g. price updates
   */
  prepare?: () => Promise<RawTx[]>;
  verify: () => Promise<void>;
}

function random<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

describe("Emergency actions through kill switch proxy", () => {
  let client: ForkClient;
  let walletClient: WalletClient<Transport, Chain>;
  let snapshotId: Quantity | undefined;
  let sdk: OnchainSDK;

  let mc: MarketConfiguratorContract;
  let proxy: KillSwitchProxyContract;
  // previous emergency admin, it is the only one who can call through the proxy
  let caller: Address;
  let owner: Address;
  let cases: Partial<Record<EmergencyActionsType, EmergencyCase>>;

  const send = (from: Address, tx: RawTx) =>
    impersonateAndSendTx({ client, walletClient, from, tx });

  /**
   * Simulates transaction and returns name of the custom error it reverts with,
   * or undefined if it succeeds
   */
  async function revertName(
    from: Address,
    tx: RawTx
  ): Promise<string | undefined> {
    const { functionName, args } = decodeFunctionData({
      abi: routingAbi,
      data: tx.callData,
    });
    try {
      await client.simulateContract({
        account: from,
        address: tx.to,
        abi: routingAbi,
        functionName,
        args,
      });
    } catch (e) {
      const revert =
        e instanceof BaseError
          ? e.walk((err) => err instanceof ContractFunctionRevertedError)
          : null;
      return revert instanceof ContractFunctionRevertedError
        ? (revert.data?.errorName ?? revert.shortMessage)
        : String(e);
    }
    return undefined;
  }

  async function getRawTx(action: EmergencyActions): Promise<RawTx> {
    const { tx } = await emergencyActionsMap[action.type].getRawTx({
      mc,
      action,
    });
    return tx;
  }

  function getCase(
    type: EmergencyActionsType,
    skip: () => void
  ): EmergencyCase {
    const c = cases[type];
    if (!c) {
      console.warn(
        `No suitable market in configurator ${mc.address} for ${type}`
      );
      skip();
    }
    return c!;
  }

  beforeAll(async () => {
    if (!RPC) throw new Error("Please provide rpc url");
    if (!AP || !isAddress(AP))
      throw new Error("Please provide address provider address");

    const chain = await detectChain(RPC);
    client = createPublicClient({
      chain,
      transport: http(ANVIL_RPC, {
        timeout: 300_000,
      }),
      cacheTime: 0,
      pollingInterval: 50,
    }).extend(testActions({ mode: "anvil" })) as unknown as ForkClient;
    walletClient = createWalletClient({
      chain,
      transport: http(ANVIL_RPC, { timeout: 300_000 }),
    });
    snapshotId = await client.snapshot();

    sdk = new OnchainSDK(getNetworkType(chain.id), { rpcURLs: [RPC] });
    await sdk.attach({ addressProvider: AP });

    const marketsByConfigurator = new Map<Address, MarketSuite[]>();
    for (const market of sdk.marketRegister.markets) {
      if (market.pool.pool.isPaused || market.pool.pool.version < 310) {
        continue;
      }
      const address = getAddress(market.configurator.address);
      marketsByConfigurator.set(address, [
        ...(marketsByConfigurator.get(address) ?? []),
        market,
      ]);
    }
    const picked = random([...marketsByConfigurator.entries()]);
    expect(picked).toBeDefined();
    const [configurator, markets] = picked!;
    mc = new MarketConfiguratorContract(configurator, client);

    console.group("==================================");
    console.log(`Configurator: ${mc.address}`);
    console.log(
      `Markets: ${markets.map((m) => m.pool.pool.address).join(", ")}`
    );

    const emergencyAdmin = await mc.getEmergencyAdmin();
    if (emergencyAdmin.type === "killSwitch") {
      if (emergencyAdmin.isKilled) {
        throw new Error(
          `Kill switch proxy ${emergencyAdmin.address} of ${mc.address} is already killed`
        );
      }
      console.log(`Kill switch proxy is already set: ${emergencyAdmin.address}`);
      proxy = new KillSwitchProxyContract(emergencyAdmin.address, client);
      caller = emergencyAdmin.caller;
      owner = emergencyAdmin.owner;
    } else {
      caller = emergencyAdmin.address;
      owner = KILL_SWITCH_OWNER;

      await allowKillSwitchProxyOnFork({ client, walletClient });
      const curatorName = await client.readContract({
        address: mc.address,
        abi: iMarketConfiguratorV310Abi,
        functionName: "curatorName",
      });
      const deployment = await KillSwitchProxyContract.prepareDeploy(
        new BytecodeRepositoryContract(Addresses.BYTECODE_REPOSITORY, client),
        { deployer: owner, owner, caller, salt: killSwitchProxySalt(curatorName) }
      );
      if (!deployment.isAlreadyDeployed) {
        await send(owner, deployment.tx);
      }
      await send(
        await mc.contract.read.admin(),
        mc.setEmergencyAdmin(deployment.address)
      );
      proxy = new KillSwitchProxyContract(deployment.address, client);
      console.log(`Deployed kill switch proxy: ${proxy.address}`);
    }
    console.log(`Proxy caller (previous emergency admin): ${caller}`);
    console.log(`Proxy owner: ${owner}`);

    cases = await buildCases(markets);
    console.groupEnd();
  });

  afterAll(async () => {
    if (snapshotId) {
      await client.revert({ id: snapshotId });
    }
  });

  async function buildCases(
    markets: MarketSuite[]
  ): Promise<Partial<Record<EmergencyActionsType, EmergencyCase>>> {
    const result: Partial<Record<EmergencyActionsType, EmergencyCase>> = {};
    const log = (type: EmergencyActionsType, params: object) =>
      console.log(`${type}: ${JSON.stringify(params)}`);

    const creditSuites = markets
      .flatMap((m) => m.creditManagers)
      .filter(
        (cm) =>
          !cm.creditFacade.isPaused &&
          cm.creditFacade.maxDebtPerBlockMultiplier > 0n &&
          cm.creditManager.version >= 310
      );

    // ORACLE::setPriceFeed
    // price feed store is read from upstream rpc: on fork, its storage is fetched slot by slot and hits rpc rate limits
    const priceFeedStore = new PriceFeedStoreContract(
      Addresses.PRICE_FEED_STORE,
      createPublicClient({ chain: client.chain, transport: http(RPC) })
    );
    const tokenToPriceFeeds = await priceFeedStore.getTokenPriceFeedsMap();
    const priceFeedsInfo = await priceFeedStore.getPriceFeedsInfo([
      ...new Set(
        tokenToPriceFeeds.flatMap(({ priceFeeds }) =>
          priceFeeds.map((pf) => getAddress(pf))
        )
      ),
    ]);
    const feedCandidates = shuffle(markets).flatMap((market) =>
      market.pool.pqk.quotas.keys().flatMap((token) => {
        const mainPriceFeed =
          market.priceOracle.mainPriceFeeds.get(token)?.address ?? zeroAddress;
        const storeFeeds =
          tokenToPriceFeeds.find(({ token: t }) => isAddressEqual(t, token))
            ?.priceFeeds ?? [];
        return priceFeedsInfo
          .filter(
            (pf) =>
              storeFeeds.some((f) => isAddressEqual(f, pf.address)) &&
              !isAddressEqual(pf.address, mainPriceFeed) &&
              pf.contractType !== "PRICE_FEED::ZERO"
          )
          .map((pf) => ({ market, token, priceFeed: pf.address }));
      })
    );
    const feed = random(feedCandidates);
    if (feed) {
      const params = {
        pool: feed.market.pool.pool.address,
        token: feed.token,
        priceFeed: feed.priceFeed,
      };
      log("ORACLE::setPriceFeed", params);
      result["ORACLE::setPriceFeed"] = {
        action: { type: "ORACLE::setPriceFeed", params },
        prepare: async () => {
          const updateTx = await getPriceUpdateTx({
            client,
            priceFeeds: [feed.priceFeed],
            useMulticall3: true,
          });
          return updateTx ? [updateTx] : [];
        },
        verify: async () => {
          const mainFeed = await client.readContract({
            address: feed.market.priceOracle.address,
            abi: parseAbi([
              "function priceFeeds(address) view returns (address)",
            ]),
            functionName: "priceFeeds",
            args: [feed.token],
          });
          expect(isAddressEqual(mainFeed, feed.priceFeed)).toBe(true);
        },
      };
    }

    // LOSS_POLICY::setAccessMode, LOSS_POLICY::setChecksEnabled
    const aliased = shuffle(markets)
      .map((market) => ({
        market,
        state: getLossPolicyState(market.state.lossPolicy.baseParams),
      }))
      .find(({ state }) => state.type === "LOSS_POLICY::ALIASED");
    if (aliased) {
      const pool = aliased.market.pool.pool.address;
      const lossPolicy = aliased.state.lossPolicy;
      const [accessMode, checksEnabled] = await client.multicall({
        allowFailure: false,
        contracts: [
          {
            address: lossPolicy,
            abi: aliasedLossPolicyAbi,
            functionName: "accessMode",
          },
          {
            address: lossPolicy,
            abi: aliasedLossPolicyAbi,
            functionName: "checksEnabled",
          },
        ],
      });

      const mode = random(
        (
          Object.values(AccessMode).filter(
            (value) => typeof value === "number"
          ) as AccessMode[]
        ).filter((m) => m !== accessMode)
      )!;
      log("LOSS_POLICY::setAccessMode", { pool, mode });
      result["LOSS_POLICY::setAccessMode"] = {
        action: { type: "LOSS_POLICY::setAccessMode", params: { pool, mode } },
        verify: async () => {
          const after = await client.readContract({
            address: lossPolicy,
            abi: aliasedLossPolicyAbi,
            functionName: "accessMode",
          });
          expect(after).toBe(mode);
        },
      };

      log("LOSS_POLICY::setChecksEnabled", { pool, enabled: !checksEnabled });
      result["LOSS_POLICY::setChecksEnabled"] = {
        action: {
          type: "LOSS_POLICY::setChecksEnabled",
          params: { pool, enabled: !checksEnabled },
        },
        verify: async () => {
          const after = await client.readContract({
            address: lossPolicy,
            abi: aliasedLossPolicyAbi,
            functionName: "checksEnabled",
          });
          expect(after).toBe(!checksEnabled);
        },
      };
    }

    // POOL::setTokenLimitToZero
    const quota = random(
      markets.flatMap((market) =>
        market.pool.pqk.quotas
          .values()
          .filter(({ limit }) => limit > 0n)
          .map(({ token }) => ({ market, token }))
      )
    );
    if (quota) {
      const params = { pool: quota.market.pool.pool.address, token: quota.token };
      log("POOL::setTokenLimitToZero", params);
      result["POOL::setTokenLimitToZero"] = {
        action: { type: "POOL::setTokenLimitToZero", params },
        verify: async () => {
          const tokenParams = await client.readContract({
            address: quota.market.pool.pqk.address,
            abi: iPoolQuotaKeeperV310Abi,
            functionName: "getTokenQuotaParams",
            args: [quota.token],
          });
          expect(tokenParams[4]).toBe(0n);
        },
      };
    }

    // POOL::setCreditManagerDebtLimitToZero
    const debt = random(
      markets.flatMap((market) =>
        market.creditManagers
          .filter(
            (cm) =>
              (market.pool.pool.creditManagerDebtParams.get(
                cm.creditManager.address
              )?.limit ?? 0n) > 0n
          )
          .map((cm) => ({ market, creditManager: cm.creditManager.address }))
      )
    );
    if (debt) {
      const params = {
        pool: debt.market.pool.pool.address,
        creditManager: debt.creditManager,
      };
      log("POOL::setCreditManagerDebtLimitToZero", params);
      result["POOL::setCreditManagerDebtLimitToZero"] = {
        action: { type: "POOL::setCreditManagerDebtLimitToZero", params },
        verify: async () => {
          const limit = await client.readContract({
            address: debt.market.pool.pool.address,
            abi: iPoolV310Abi,
            functionName: "creditManagerDebtLimit",
            args: [debt.creditManager],
          });
          expect(limit).toBe(0n);
        },
      };
    }

    // CREDIT::forbidAdapter, adapters are read from the fork, since they might be already forbidden there
    for (const cm of shuffle(creditSuites)) {
      const adapters = await client.readContract({
        address: cm.creditConfigurator.address,
        abi: iCreditConfiguratorV310Abi,
        functionName: "allowedAdapters",
      });
      const adapter = random([...adapters]);
      if (!adapter) continue;

      const params = { creditManager: cm.creditManager.address, adapter };
      log("CREDIT::forbidAdapter", params);
      result["CREDIT::forbidAdapter"] = {
        action: { type: "CREDIT::forbidAdapter", params },
        verify: async () => {
          const after = await client.readContract({
            address: cm.creditConfigurator.address,
            abi: iCreditConfiguratorV310Abi,
            functionName: "allowedAdapters",
          });
          expect(after.some((a) => isAddressEqual(a, adapter))).toBe(false);
        },
      };
      break;
    }

    // CREDIT::forbidToken
    for (const cm of shuffle(creditSuites)) {
      const forbiddenMask = await client.readContract({
        address: cm.creditFacade.address,
        abi: iCreditFacadeV310Abi,
        functionName: "forbiddenTokenMask",
      });
      const tokens = cm.creditManager.collateralTokens;
      const masks = await client.multicall({
        allowFailure: false,
        contracts: tokens.map((token) => ({
          address: cm.creditManager.address,
          abi: iCreditManagerV310Abi,
          functionName: "getTokenMaskOrRevert" as const,
          args: [token] as const,
        })),
      });
      const collateral = random(
        tokens
          .map((token, i) => ({ token, mask: masks[i] }))
          .filter(
            ({ token, mask }) =>
              (forbiddenMask & mask) === 0n &&
              !isAddressEqual(token, cm.underlying)
          )
      );
      if (!collateral) continue;

      const params = {
        creditManager: cm.creditManager.address,
        token: collateral.token,
      };
      log("CREDIT::forbidToken", params);
      result["CREDIT::forbidToken"] = {
        action: { type: "CREDIT::forbidToken", params },
        verify: async () => {
          const after = await client.readContract({
            address: cm.creditFacade.address,
            abi: iCreditFacadeV310Abi,
            functionName: "forbiddenTokenMask",
          });
          expect(after & collateral.mask).not.toBe(0n);
        },
      };
      break;
    }

    // CREDIT::forbidBorrowing
    const borrowing = random(creditSuites);
    if (borrowing) {
      const params = { creditManager: borrowing.creditManager.address };
      log("CREDIT::forbidBorrowing", params);
      result["CREDIT::forbidBorrowing"] = {
        action: { type: "CREDIT::forbidBorrowing", params },
        verify: async () => {
          const multiplier = await client.readContract({
            address: borrowing.creditFacade.address,
            abi: iCreditFacadeV310Abi,
            functionName: "maxDebtPerBlockMultiplier",
          });
          expect(multiplier).toBe(0);
        },
      };
    }

    // CREDIT::pause
    const credit = random(creditSuites);
    if (credit) {
      const params = { creditManager: credit.creditManager.address };
      log("CREDIT::pause", params);
      result["CREDIT::pause"] = {
        action: { type: "CREDIT::pause", params },
        verify: async () => {
          const paused = await client.readContract({
            address: credit.creditFacade.address,
            abi: pausableAbi,
            functionName: "paused",
          });
          expect(paused).toBe(true);
        },
      };
    }

    // POOL::pause
    const market = random(markets)!;
    const pool = market.pool.pool.address;
    log("POOL::pause", { pool });
    result["POOL::pause"] = {
      action: { type: "POOL::pause", params: { pool } },
      verify: async () => {
        const paused = await client.readContract({
          address: pool,
          abi: pausableAbi,
          functionName: "paused",
        });
        expect(paused).toBe(true);
      },
    };

    return result;
  }

  it("sets kill switch proxy as emergency admin", async () => {
    await expect(mc.getEmergencyAdmin()).resolves.toEqual({
      type: "killSwitch",
      address: proxy.address,
      caller,
      owner,
      isKilled: false,
      executor: caller,
    });
  });

  describe("not through proxy", () => {
    it.for(EMERGENCY_ADMIN_ACTIONS)(
      "%s is rejected for previous emergency admin",
      async (type, { skip }) => {
        const { action } = getCase(type, skip);
        const tx = await getRawTx(action);
        expect(isAddressEqual(tx.to, mc.address)).toBe(true);

        await expect(revertName(caller, tx)).resolves.toBe(
          "CallerIsNotEmergencyAdminException"
        );
      }
    );

    it.for(EMERGENCY_ADMIN_ACTIONS)(
      "%s is rejected for stranger calling proxy",
      async (type, { skip }) => {
        const { action } = getCase(type, skip);
        const tx = await getEmergencyTx({ mc, action });

        await expect(revertName(STRANGER, tx.tx)).resolves.toBe(
          "OnlyCallerException"
        );
      }
    );
  });

  // must run after "not through proxy": rejections there are checked against untouched state
  describe("through proxy", () => {
    it.for(EMERGENCY_ADMIN_ACTIONS)(
      "%s is executed by proxy caller",
      async (type, { skip }) => {
        const { action, prepare, verify } = getCase(type, skip);
        const { tx } = await getEmergencyTx({ mc, action });
        expect(isAddressEqual(tx.to, proxy.address)).toBe(true);

        for (const prepareTx of (await prepare?.()) ?? []) {
          await send(caller, prepareTx);
        }
        await send(caller, tx);
        await verify();
      }
    );
  });

  describe("after proxy is killed", () => {
    beforeAll(async () => {
      await send(owner, proxy.killTx());
      await expect(proxy.isKilled()).resolves.toBe(true);
    });

    it.for(EMERGENCY_ADMIN_ACTIONS)(
      "%s is not built",
      async (type, { skip }) => {
        const { action } = getCase(type, skip);
        await expect(getEmergencyTx({ mc, action })).rejects.toThrow(
          /killed/
        );
      }
    );

    it.for(EMERGENCY_ADMIN_ACTIONS)(
      "%s is rejected by proxy",
      async (type, { skip }) => {
        const { action } = getCase(type, skip);
        const tx = proxy.proxyCallTx(await getRawTx(action));

        await expect(revertName(caller, tx)).resolves.toBe("KilledException");
      }
    );

    it.for(EMERGENCY_ADMIN_ACTIONS)(
      "%s is still rejected for previous emergency admin",
      async (type, { skip }) => {
        const { action } = getCase(type, skip);

        await expect(revertName(caller, await getRawTx(action))).resolves.toBe(
          "CallerIsNotEmergencyAdminException"
        );
      }
    );
  });
});
