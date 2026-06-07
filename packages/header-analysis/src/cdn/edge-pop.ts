import { parseCfRay } from "../parser/cf-ray";
import { regions as iataRegions } from "../regions/cloudflare";
import { regions as vercelRegions } from "../regions/vercel";
import type { CdnProvider } from "./detect-cdn";
import { getHeader } from "./get-header";

export interface EdgePop {
  /** PoP/colo code, e.g. "FRA" or "fra1" */
  pop: string | null;
  /** best-effort city name resolved from the IATA code */
  location: string | null;
}

// the cloudflare map is keyed by IATA airport codes, so it doubles as a
// generic IATA → city lookup for other vendors' PoP codes
function lookupIata(code: string): string | null {
  return iataRegions[code.toUpperCase()]?.location ?? null;
}

export function extractEdgePop(
  headers: Record<string, string>,
  provider: CdnProvider | null,
): EdgePop {
  switch (provider) {
    case "cloudflare": {
      const ray = getHeader(headers, "cf-ray");
      if (!ray) break;
      const parsed = parseCfRay(ray);
      if (parsed.status === "success") {
        return { pop: parsed.data.code, location: parsed.data.location };
      }
      const code = ray.match(/\b([A-Z]{3})\b/)?.[1];
      if (code) return { pop: code, location: lookupIata(code) };
      break;
    }
    case "cloudfront": {
      // e.g. "FRA56-P5" — leading 3 letters are the IATA code
      const pop = getHeader(headers, "x-amz-cf-pop");
      const code = pop?.match(/^([A-Z]{3})/)?.[1];
      if (pop && code) return { pop, location: lookupIata(code) };
      break;
    }
    case "fastly": {
      // e.g. "cache-fra-etou8220141-FRA" — trailing segment is the IATA code
      const servedBy = getHeader(headers, "x-served-by");
      const code = servedBy?.match(/-([A-Z]{3})$/)?.[1];
      if (code) return { pop: code, location: lookupIata(code) };
      break;
    }
    case "vercel": {
      // e.g. "fra1::iad1::82mqm-..." — first segment is the serving edge
      const id = getHeader(headers, "x-vercel-id");
      const pop = id?.match(/^([a-z]{3}\d*)/)?.[1];
      if (pop) {
        const known = vercelRegions[pop];
        return {
          pop,
          location: known?.location ?? lookupIata(pop.slice(0, 3)),
        };
      }
      break;
    }
    default:
      break;
  }

  return { pop: null, location: null };
}
