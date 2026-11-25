import type { CdnProvider } from "./detect-cdn";

export type Topology = "anycast" | "unicast" | "unknown";

export interface TopologyInference {
  topology: Topology;
  /** "edge-ips" is measured; "provider" is a known-architecture heuristic */
  basis: "edge-ips" | "provider" | null;
}

// networks with a publicly documented anycast (or geo-routed) architecture —
// used only when edge IPs are unavailable
const PROVIDER_TOPOLOGY: Partial<Record<CdnProvider, Topology>> = {
  cloudflare: "anycast",
  fastly: "anycast",
  vercel: "anycast",
  cloudfront: "unicast",
  akamai: "unicast",
};

export function inferTopology(
  rows: { edgeIp: string | null }[],
  provider: CdnProvider | null,
): TopologyInference {
  const measured = rows
    .map((row) => row.edgeIp)
    .filter((ip): ip is string => Boolean(ip));
  const ips = new Set(measured);

  if (ips.size >= 2) return { topology: "unicast", basis: "edge-ips" };
  // a single IP only signals anycast with enough measured vantage points —
  // rows without an edge IP are not evidence
  if (ips.size === 1 && measured.length >= 3) {
    return { topology: "anycast", basis: "edge-ips" };
  }

  const fromProvider = provider ? PROVIDER_TOPOLOGY[provider] : undefined;
  if (fromProvider) return { topology: fromProvider, basis: "provider" };

  return { topology: "unknown", basis: null };
}
