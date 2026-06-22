const STORAGE_KEY = "permissionless-safe.custom-rpcs";

type CustomRpcMap = Record<string, string>;

function readMap(): CustomRpcMap {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as CustomRpcMap;
    }
    return {};
  } catch {
    return {};
  }
}

function writeMap(map: CustomRpcMap): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / serialization errors
  }
}

/** Returns all configured custom RPC URLs keyed by numeric chain id. */
export function getCustomRpcUrls(): Record<number, string> {
  const map = readMap();
  return Object.entries(map).reduce<Record<number, string>>(
    (acc, [chainId, url]) => {
      const id = Number(chainId);
      if (!Number.isNaN(id) && typeof url === "string" && url.length > 0) {
        acc[id] = url;
      }
      return acc;
    },
    {}
  );
}

/** Returns the custom RPC URL for a chain, or undefined when not set. */
export function getCustomRpcUrl(chainId: number): string | undefined {
  const url = readMap()[String(chainId)];
  return typeof url === "string" && url.length > 0 ? url : undefined;
}

/** Stores a custom RPC URL for a chain. */
export function setCustomRpcUrl(chainId: number, url: string): void {
  const map = readMap();
  map[String(chainId)] = url.trim();
  writeMap(map);
}

/** Removes the custom RPC URL for a chain. */
export function removeCustomRpcUrl(chainId: number): void {
  const map = readMap();
  delete map[String(chainId)];
  writeMap(map);
}

/** Basic validation for an http(s) RPC endpoint. */
export function isValidRpcUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
