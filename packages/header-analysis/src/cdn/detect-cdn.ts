import { getHeader } from "./get-header";

export const CDN_PROVIDERS = [
  "cloudflare",
  "cloudfront",
  "fastly",
  "akamai",
  "vercel",
  "bunny",
  "netlify",
  "keycdn",
  "imperva",
  "sucuri",
  "azure-front-door",
  "google",
] as const;

export type CdnProvider = (typeof CDN_PROVIDERS)[number];

export const CDN_LABELS: Record<CdnProvider, string> = {
  cloudflare: "Cloudflare",
  cloudfront: "Amazon CloudFront",
  fastly: "Fastly",
  akamai: "Akamai",
  vercel: "Vercel",
  bunny: "Bunny CDN",
  netlify: "Netlify",
  keycdn: "KeyCDN",
  imperva: "Imperva",
  sucuri: "Sucuri",
  "azure-front-door": "Azure Front Door",
  google: "Google Cloud CDN",
};

export interface CdnDetection {
  provider: CdnProvider | null;
  /** header names (or `header: value` pairs) that matched */
  evidence: string[];
}

type Fingerprint = {
  provider: CdnProvider;
  headers?: string[];
  /** substring match against the given header's value (lowercased) */
  contains?: {
    header: string;
    value: string;
    /**
     * broad signal shared with non-CDN infra (e.g. `via: 1.1 google` is also
     * sent by Google's load balancer/translate proxy): counts as evidence only
     * when a non-broad signal corroborates it, never matches on its own
     */
    broad?: boolean;
  }[];
};

// ordered outermost-proxy first: when stacked (e.g. Cloudflare in front of
// Vercel) the first match is the network that actually served the client
const FINGERPRINTS: Fingerprint[] = [
  {
    provider: "cloudflare",
    headers: ["cf-ray", "cf-cache-status"],
    contains: [{ header: "server", value: "cloudflare" }],
  },
  {
    provider: "akamai",
    headers: [
      "x-akamai-request-id",
      "x-akamai-transformed",
      "x-check-cacheable",
    ],
    contains: [{ header: "server", value: "akamaighost" }],
  },
  {
    provider: "imperva",
    headers: ["x-iinfo"],
    contains: [{ header: "x-cdn", value: "incapsula" }],
  },
  {
    provider: "sucuri",
    headers: ["x-sucuri-id", "x-sucuri-cache"],
  },
  {
    provider: "fastly",
    headers: ["x-fastly-request-id", "fastly-debug-digest"],
    contains: [
      { header: "x-served-by", value: "cache-" },
      { header: "via", value: "fastly" },
    ],
  },
  {
    provider: "cloudfront",
    headers: ["x-amz-cf-id", "x-amz-cf-pop"],
    contains: [{ header: "via", value: "cloudfront" }],
  },
  {
    provider: "bunny",
    headers: ["cdn-pullzone", "cdn-requestid"],
    contains: [{ header: "server", value: "bunnycdn" }],
  },
  {
    provider: "keycdn",
    contains: [{ header: "server", value: "keycdn" }],
  },
  {
    provider: "azure-front-door",
    headers: ["x-azure-ref"],
  },
  {
    provider: "google",
    headers: ["x-goog-cache-status", "x-google-cache-control"],
    contains: [{ header: "via", value: "1.1 google", broad: true }],
  },
  {
    provider: "netlify",
    headers: ["x-nf-request-id"],
    contains: [{ header: "server", value: "netlify" }],
  },
  {
    provider: "vercel",
    headers: ["x-vercel-id", "x-vercel-cache"],
    contains: [{ header: "server", value: "vercel" }],
  },
];

export function detectCdn(headers: Record<string, string>): CdnDetection {
  for (const fingerprint of FINGERPRINTS) {
    const evidence: string[] = [];
    // broad signals (e.g. `via: 1.1 google`) can't match alone — require a
    // corroborating strong signal so non-CDN Google infra isn't misdetected
    let strongMatches = 0;

    for (const name of fingerprint.headers ?? []) {
      if (getHeader(headers, name)) {
        evidence.push(name);
        strongMatches++;
      }
    }
    for (const { header, value, broad } of fingerprint.contains ?? []) {
      const actual = getHeader(headers, header);
      if (actual?.toLowerCase().includes(value)) {
        evidence.push(`${header}: ${actual}`);
        if (!broad) strongMatches++;
      }
    }

    if (strongMatches > 0) {
      return { provider: fingerprint.provider, evidence };
    }
  }

  return { provider: null, evidence: [] };
}
