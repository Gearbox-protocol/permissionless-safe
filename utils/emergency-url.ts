/**
 * Build emergency page URL with query params.
 * Next.js App Router Link does NOT support { pathname, query } object format;
 * only string URLs work in production (e.g. static export).
 */
export function buildEmergencyUrl(
  chainId: number,
  mc: string,
  market?: string,
): string {
  const params = new URLSearchParams({
    chainId: String(chainId),
    mc,
  });
  if (market !== undefined) {
    params.set("market", market);
  }
  return `/emergency?${params.toString()}`;
}

/**
 * Build emergency tx page URL with query params.
 */
export function buildEmergencyTxUrl(
  chainId: number,
  mc: string,
  action: string,
  params: Record<string, unknown>,
): string {
  const search = new URLSearchParams({
    chainId: String(chainId),
    mc,
    action,
    params: JSON.stringify(params),
  });
  return `/emergency/tx?${search.toString()}`;
}
