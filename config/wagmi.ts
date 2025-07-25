import { ArchiveTransport } from "@gearbox-protocol/permissionless";
import { getDefaultConfig } from "connectkit";
import { Chain, Transport } from "viem";
import { createConfig, http } from "wagmi";
import {
  avalanche,
  base,
  bsc,
  etherlink,
  mainnet,
  worldchain,
  hemi,
  lisk
} from "wagmi/chains";
// import { safe, walletConnect } from "wagmi/connectors";

export const getChainTransport = (chain: Chain): Transport => {
  const primaryRpcUrl =
    process.env.NEXT_PUBLIC_MAINNET_NODE_URI ??
    process.env.NEXT_PUBLIC_RPC_URL ??
    chain.rpcUrls.default.http[0];

  // Etherlink
  if (chain.id === 42793) {
    return new ArchiveTransport({
      primaryRpcUrl,
      archiveRpcUrl: "https://explorer.etherlink.com/api/eth-rpc",
      blockThreshold: 999,
      enableLogging: true,
    }).getTransport();
  }

  if (chain.id === 56) {
    return new ArchiveTransport({
      primaryRpcUrl: "https://bsc.drpc.org", // tmp solution
      archiveRpcUrl: "https://bsc.rpc.hypersync.xyz",
      blockThreshold: 50,
      enableLogging: true,
    }).getTransport();
  }

  if (chain.id === hemi.id) {
    return new ArchiveTransport({
      primaryRpcUrl,
      archiveRpcUrl: "https://explorer.hemi.xyz/api/eth-rpc",
      blockThreshold: 50,
      enableLogging: true,
    }).getTransport();
  }

  if (chain.id === mainnet.id) {
    return http("https://lb.drpc.org/ethereum/ArgL9xL92k_VqiTUtSp0KHGND7jiYtUR8Ku4EklbR4ac", {
      retryCount: 3,
      retryDelay: 1000,
      timeout: 10000,
    });
  }

  if (chain.id === lisk.id) {
    return new ArchiveTransport({
      primaryRpcUrl: "https://lb.drpc.org/lisk/ArgL9xL92k_VqiTUtSp0KHGND7jiYtUR8Ku4EklbR4ac", // tmp solution
      archiveRpcUrl: "https://lisk.rpc.hypersync.xyz",
      blockThreshold: 200,
      enableLogging: true,
    }).getTransport();
  }

  // Try to use window.ethereum if available
  // if (typeof window !== "undefined" && window.ethereum) {
  //   return custom(window.ethereum);
  // }

  // Default fallback
  return http(primaryRpcUrl, {
    retryCount: 3,
    retryDelay: 1000,
    timeout: 10000,
  });
};

const chains = [
  mainnet,
  base,
  avalanche,
  // monadTestnet,
  bsc,
  worldchain,
  etherlink,
  hemi,
  lisk
] as const;

export const config = createConfig(
  getDefaultConfig({
    chains,
    transports: {
      [mainnet.id]: getChainTransport(mainnet),
      [base.id]: getChainTransport(base),
      [avalanche.id]: getChainTransport(avalanche),
      // [monadTestnet.id]: getChainTransport(monadTestnet),
      [bsc.id]: getChainTransport(bsc),
      [worldchain.id]: getChainTransport(worldchain),
      [etherlink.id]: getChainTransport(etherlink),
      [hemi.id]: getChainTransport(hemi),
      [lisk.id]: getChainTransport(lisk),
    } as Record<number, Transport>,

    // connectors: [
    //   safe({
    //     allowedDomains: [/app.safe.global$/],
    //   }),
    //   walletConnect({
    //     projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
    //     qrModalOptions: { themeVariables: { "--wcm-z-index": "210" } },
    //   }),
    //   injected(),
    // ],

    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",

    // Required App Info
    appName: "Gearbox Safe Reserve",

    // Optional App Info
    appDescription: "Gearbox Safe Reserve",
    appUrl: "https://gearbox.fi", // your app's url
    appIcon: "https://static.gearbox.fi/logo/logo_symbol.png", // your app's icon, no bigger than 1024x1024px (max. 1MB)
  })
);

export const defaultChainId = 1;
