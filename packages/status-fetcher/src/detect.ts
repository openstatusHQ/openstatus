import { Effect } from "effect";

import type { FetchError } from "./fetch";
import { fetchJson, fetchTextWithUrl } from "./fetch";
import { atlassianResponseSchema } from "./fetchers/atlassian";
import { betterStackResponseSchema } from "./fetchers/betterstack";
import { instatusResponseSchema } from "./fetchers/instatus";
import type { ApiConfigType, StatusPageProvider } from "./types";
import { urlHostnameEndsWith } from "./utils";

export type DetectableApiType = Extract<
  ApiConfigType,
  "atlassian" | "incidentio" | "instatus" | "betterstack"
>;

export type ProviderMatch = {
  type: DetectableApiType;
  provider: StatusPageProvider;
  endpoint: string;
};

export type DetectionResult = {
  currentProviderValidated: boolean;
  matches: ProviderMatch[];
  hostnameSuggestions: StatusPageProvider[];
  // Set when the page redirects to another origin whose probes validate: the
  // stored status_page_url is stale, not (necessarily) the provider.
  movedTo?: { base: string; matches: ProviderMatch[] };
  evidence: string[];
};

type Candidate = { type: DetectableApiType; provider: StatusPageProvider };

type Probe = {
  path: string;
  candidates: Candidate[];
  validate: (url: string, entryId?: string) => Effect.Effect<void, FetchError>;
};

// atlassian and incident.io expose the identical summary API, so one probe
// carries both candidates and the pair is disambiguated afterwards.
const PROBES: Probe[] = [
  {
    path: "/api/v2/summary.json",
    candidates: [
      { type: "atlassian", provider: "atlassian-statuspage" },
      { type: "incidentio", provider: "incidentio" },
    ],
    validate: (url, entryId) =>
      fetchJson({
        url,
        schema: atlassianResponseSchema,
        fetcherName: "detect",
        entryId,
      }).pipe(Effect.asVoid),
  },
  {
    path: "/summary.json",
    candidates: [{ type: "instatus", provider: "instatus" }],
    validate: (url, entryId) =>
      fetchJson({
        url,
        schema: instatusResponseSchema,
        fetcherName: "detect",
        entryId,
      }).pipe(Effect.asVoid),
  },
  {
    path: "/index.json",
    candidates: [{ type: "betterstack", provider: "better-uptime" }],
    validate: (url, entryId) =>
      fetchJson({
        url,
        schema: betterStackResponseSchema,
        fetcherName: "detect",
        entryId,
      }).pipe(Effect.asVoid),
  },
];

type HostnameHit = { domain: string; provider: StatusPageProvider };

const HOSTNAME_EVIDENCE: HostnameHit[] = [
  { domain: "statuspage.io", provider: "atlassian-statuspage" },
  { domain: "status.atlassian.com", provider: "atlassian-statuspage" },
  { domain: "incident.io", provider: "incidentio" },
  { domain: "incidentio.com", provider: "incidentio" },
  { domain: "instatus.com", provider: "instatus" },
  { domain: "betteruptime.com", provider: "better-uptime" },
  { domain: "betterstack.com", provider: "better-uptime" },
  { domain: "stats.uptimerobot.com", provider: "uptime-robot" },
];

const HTML_MARKERS: { provider: StatusPageProvider; needle: string }[] = [
  { provider: "incidentio", needle: "incident.io" },
  { provider: "atlassian-statuspage", needle: "statuspage.io" },
  { provider: "instatus", needle: "instatus.com" },
  { provider: "better-uptime", needle: "betteruptime.com" },
];

const describeError = (err: FetchError): string =>
  `${err.kind ?? "error"}${err.httpStatus ? ` ${err.httpStatus}` : ""}`;

const hostnameHits = (url: string): HostnameHit[] =>
  HOSTNAME_EVIDENCE.filter((h) => urlHostnameEndsWith(url, h.domain));

const htmlMarkerHits = (html: string) => {
  const lower = html.toLowerCase();
  return HTML_MARKERS.filter((m) => lower.includes(m.needle));
};

const trimTrailingSlash = (value: string): string => {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end--;
  return value.slice(0, end);
};

// URL parsing drops query/hash so probe paths append to the page path; the
// fallbacks keep the error channel `never` for unparseable input.
const probeBase = (statusPageUrl: string): string => {
  try {
    const url = new URL(statusPageUrl);
    return trimTrailingSlash(`${url.origin}${url.pathname}`);
  } catch {
    return trimTrailingSlash(statusPageUrl);
  }
};

const canonicalHref = (value: string): string => {
  try {
    return new URL(value).href;
  } catch {
    return value;
  }
};

const originOf = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const isPair = (candidates: ProviderMatch[]): boolean =>
  candidates.length === 2 &&
  candidates.every((c) => c.type === "atlassian" || c.type === "incidentio");

const runProbes = (
  base: string,
  entryId: string | undefined,
  evidence: string[],
): Effect.Effect<ProviderMatch[]> =>
  Effect.forEach(
    PROBES,
    (probe) => {
      const endpoint = `${base}${probe.path}`;
      return probe.validate(endpoint, entryId).pipe(
        Effect.match({
          onSuccess: () => ({ probe, endpoint, ok: true }),
          onFailure: (err: FetchError) => {
            evidence.push(`${endpoint}: ${describeError(err)}`);
            return { probe, endpoint, ok: false };
          },
        }),
      );
    },
    { concurrency: 3 },
  ).pipe(
    Effect.map((probed) =>
      probed
        .filter((r) => r.ok)
        .flatMap((r) => {
          evidence.push(`validated ${r.endpoint}`);
          return r.probe.candidates.map((c) => ({
            ...c,
            endpoint: r.endpoint,
          }));
        }),
    ),
  );

// Hostname evidence outranks html markers: a page hosted on a provider domain
// is unambiguous, while markers can name a competitor in prose.
const tiebreakPair = (
  candidates: ProviderMatch[],
  hits: HostnameHit[],
  html: string | undefined,
  evidence: string[],
): ProviderMatch[] => {
  const hitProviders = new Set(hits.map((h) => h.provider));
  const pairHits = candidates.filter((c) => hitProviders.has(c.provider));
  if (pairHits.length === 1) {
    evidence.push(`hostname tiebreak: ${pairHits[0].provider}`);
    return pairHits;
  }
  if (html === undefined) return candidates;
  const markerHits = htmlMarkerHits(html).filter((m) =>
    candidates.some((c) => c.provider === m.provider),
  );
  const markerProviders = new Set(markerHits.map((m) => m.provider));
  if (markerProviders.size !== 1) return candidates;
  const pick = markerHits[0];
  evidence.push(`html marker: ${pick.needle}`);
  return candidates.filter((c) => c.provider === pick.provider);
};

export const detectProvider = (args: {
  statusPageUrl: string;
  currentProvider: StatusPageProvider;
  entryId?: string;
}): Effect.Effect<DetectionResult> =>
  Effect.gen(function* () {
    const base = probeBase(args.statusPageUrl);
    const evidence: string[] = [];

    const candidates = yield* runProbes(base, args.entryId, evidence);

    // Deliberate trade-off: a validating current provider ends detection, so
    // atlassian↔incidentio label drift goes unflagged — the APIs are identical
    // and fetching works, only the public label may lag.
    if (candidates.some((c) => c.provider === args.currentProvider)) {
      return {
        currentProviderValidated: true,
        matches: [],
        hostnameSuggestions: [],
        evidence,
      };
    }

    const staticHits = hostnameHits(args.statusPageUrl);
    for (const h of staticHits) evidence.push(`hostname matches ${h.domain}`);

    const ambiguous = isPair(candidates);
    let finalUrlHits: HostnameHit[] = [];
    let matches = candidates;
    let movedTo: DetectionResult["movedTo"];
    let page: { text: string; finalUrl: string } | null = null;

    if (ambiguous || candidates.length === 0) {
      page = yield* fetchTextWithUrl({
        url: args.statusPageUrl,
        fetcherName: "detect",
        entryId: args.entryId,
      }).pipe(
        Effect.match({
          onSuccess: (p): { text: string; finalUrl: string } | null => p,
          onFailure: (err: FetchError) => {
            evidence.push(`html fetch failed: ${describeError(err)}`);
            return null;
          },
        }),
      );

      const redirected =
        page?.finalUrl &&
        canonicalHref(page.finalUrl) !== canonicalHref(args.statusPageUrl);
      if (page && redirected) {
        evidence.push(`final url ${page.finalUrl}`);
        finalUrlHits = hostnameHits(page.finalUrl);
        for (const h of finalUrlHits) {
          evidence.push(`redirect hostname matches ${h.domain}`);
        }
      }

      if (ambiguous) {
        matches = tiebreakPair(
          candidates,
          [...staticHits, ...finalUrlHits],
          page?.text,
          evidence,
        );
      }

      // Nothing validates here but the page lives elsewhere now: probe the
      // new origin so a stale status_page_url surfaces as a concrete move.
      const originMoved =
        page &&
        redirected &&
        originOf(page.finalUrl) !== null &&
        originOf(page.finalUrl) !== originOf(args.statusPageUrl);
      if (page && candidates.length === 0 && originMoved) {
        // Providers serve their API at the root, so a redirect landing on a
        // subpath must not carry that path into the probes.
        const movedBase = originOf(page.finalUrl) ?? probeBase(page.finalUrl);
        const movedCandidates = yield* runProbes(
          movedBase,
          args.entryId,
          evidence,
        );
        if (movedCandidates.length > 0) {
          movedTo = {
            base: movedBase,
            matches: isPair(movedCandidates)
              ? tiebreakPair(movedCandidates, finalUrlHits, page.text, evidence)
              : movedCandidates,
          };
        }
      }
    }

    let hostnameSuggestions: StatusPageProvider[] = [];
    if (candidates.length === 0) {
      const markerHits = page && !movedTo ? htmlMarkerHits(page.text) : [];
      for (const m of markerHits) evidence.push(`html marker: ${m.needle}`);
      hostnameSuggestions = [
        ...new Set(
          [...staticHits, ...finalUrlHits, ...markerHits]
            .map((h) => h.provider)
            .filter((p) => p !== args.currentProvider),
        ),
      ];
    }

    return {
      currentProviderValidated: false,
      matches,
      hostnameSuggestions,
      ...(movedTo ? { movedTo } : {}),
      evidence,
    };
  });
