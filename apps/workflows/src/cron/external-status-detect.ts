import type { ExternalServiceRow } from "@openstatus/services/external-service";
import type {
  DetectionResult,
  FetchError,
  StatusPageProvider,
} from "@openstatus/status-fetcher";

export const PROBE_TTL_MS = 24 * 60 * 60 * 1000;

const lastProbeAt = new Map<string, number>();

// check-and-set: stamps on `true` so a no-result probe still waits out the TTL
export function shouldProbe(
  slug: string,
  now: number,
  map: Map<string, number> = lastProbeAt,
): boolean {
  const last = map.get(slug);
  if (last !== undefined && now - last < PROBE_TTL_MS) return false;
  map.set(slug, now);
  return true;
}

// refunds the TTL after a failed write so the next tick retries
export function clearProbeStamp(
  slug: string,
  map: Map<string, number> = lastProbeAt,
): void {
  map.delete(slug);
}

export function isSuspicious(err: FetchError): boolean {
  if (err.kind === "parse") return true;
  return (
    err.kind === "http" && err.httpStatus !== undefined && err.httpStatus < 500
  );
}

export type DetectionAction =
  | { kind: "apply"; provider: StatusPageProvider; evidence: string[] }
  | { kind: "clear-config"; evidence: string[] }
  | { kind: "suggest"; suggestion: string; evidence: string[] }
  | { kind: "noop"; reason: "transient" | "no-evidence"; evidence: string[] };

export function decideDetectionAction(
  result: DetectionResult,
  row: Pick<ExternalServiceRow, "provider" | "apiConfig">,
): DetectionAction {
  const { evidence } = result;
  if (result.currentProviderValidated) {
    return row.apiConfig?.endpoint
      ? { kind: "clear-config", evidence }
      : { kind: "noop", reason: "transient", evidence };
  }
  const single = result.matches.length === 1 ? result.matches[0] : undefined;
  if (single) {
    return { kind: "apply", provider: single.provider, evidence };
  }
  if (result.matches.length >= 2) {
    return {
      kind: "suggest",
      suggestion: result.matches
        .map((m) => m.provider)
        .sort()
        .join("|"),
      evidence,
    };
  }
  if (result.hostnameSuggestions.length > 0) {
    return {
      kind: "suggest",
      suggestion: [...result.hostnameSuggestions].sort().join("|"),
      evidence,
    };
  }
  return { kind: "noop", reason: "no-evidence", evidence };
}
