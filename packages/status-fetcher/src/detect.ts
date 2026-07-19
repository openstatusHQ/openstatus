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

const HOSTNAME_EVIDENCE: { domain: string; provider: StatusPageProvider }[] = [
  { domain: "statuspage.io", provider: "atlassian-statuspage" },
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
];

const describeError = (err: FetchError): string =>
  `${err.kind ?? "error"}${err.httpStatus ? ` ${err.httpStatus}` : ""}`;

const hostnameHits = (url: string) =>
  HOSTNAME_EVIDENCE.filter((h) => urlHostnameEndsWith(url, h.domain));

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

export const detectProvider = (args: {
  statusPageUrl: string;
  currentProvider: StatusPageProvider;
  entryId?: string;
}): Effect.Effect<DetectionResult> =>
  Effect.gen(function* () {
    const base = probeBase(args.statusPageUrl);
    const evidence: string[] = [];

    const probed = yield* Effect.forEach(
      PROBES,
      (probe) => {
        const endpoint = `${base}${probe.path}`;
        return probe.validate(endpoint, args.entryId).pipe(
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
    );

    const candidates: ProviderMatch[] = probed
      .filter((r) => r.ok)
      .flatMap((r) => {
        evidence.push(`validated ${r.endpoint}`);
        return r.probe.candidates.map((c) => ({ ...c, endpoint: r.endpoint }));
      });

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

    const isPair =
      candidates.length === 2 &&
      candidates.every(
        (c) => c.type === "atlassian" || c.type === "incidentio",
      );

    let finalUrlHits: typeof staticHits = [];
    let matches = candidates;

    if (isPair || candidates.length === 0) {
      const page = yield* fetchTextWithUrl({
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

      if (
        page?.finalUrl &&
        canonicalHref(page.finalUrl) !== canonicalHref(args.statusPageUrl)
      ) {
        evidence.push(`final url ${page.finalUrl}`);
        finalUrlHits = hostnameHits(page.finalUrl);
        for (const h of finalUrlHits) {
          evidence.push(`redirect hostname matches ${h.domain}`);
        }
      }

      if (isPair) {
        const hitProviders = new Set(
          [...staticHits, ...finalUrlHits].map((h) => h.provider),
        );
        const pairHits = candidates.filter((c) => hitProviders.has(c.provider));
        const hostnamePick = pairHits.length === 1 ? pairHits[0] : undefined;
        if (hostnamePick) {
          matches = [hostnamePick];
          evidence.push(`hostname tiebreak: ${hostnamePick.provider}`);
        } else if (page) {
          const html = page.text.toLowerCase();
          const markerHits = HTML_MARKERS.filter((m) =>
            html.includes(m.needle),
          );
          const markerPick =
            new Set(markerHits.map((m) => m.provider)).size === 1
              ? markerHits[0]
              : undefined;
          if (markerPick) {
            matches = candidates.filter(
              (c) => c.provider === markerPick.provider,
            );
            evidence.push(`html marker: ${markerPick.needle}`);
          }
        }
      }
    }

    const hostnameSuggestions =
      candidates.length === 0
        ? [
            ...new Set(
              [...staticHits, ...finalUrlHits]
                .map((h) => h.provider)
                .filter((p) => p !== args.currentProvider),
            ),
          ]
        : [];

    return {
      currentProviderValidated: false,
      matches,
      hostnameSuggestions,
      evidence,
    };
  });
