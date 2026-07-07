import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { Effect } from "effect";

import { detectProvider } from "../src/detect";
import { installMockFetch } from "./helpers";

const PAGE_URL = "https://status.example.com";

const json = (body: object): Response =>
  ({
    ok: true,
    status: 200,
    statusText: "OK",
    url: "",
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as Response;

const notFound = (): Response =>
  ({
    ok: false,
    status: 404,
    statusText: "Not Found",
    json: async () => ({}),
    text: async () => "",
  }) as Response;

const html = (body: string, finalUrl = PAGE_URL): Response =>
  ({
    ok: true,
    status: 200,
    statusText: "OK",
    url: finalUrl,
    text: async () => body,
    json: async () => ({}),
  }) as Response;

const atlassianBody = {
  page: {
    id: "abc",
    name: "Example",
    url: "https://status.example.com",
    updated_at: "2024-01-01T00:00:00Z",
  },
  status: { indicator: "none", description: "All Systems Operational" },
};

const instatusBody = {
  activeIncidents: [],
  activeMaintenances: [],
  status: { text: "All systems operational", type: "UP" },
  page: {
    name: "Example",
    url: "https://status.example.com",
    updated: "2024-01-01T00:00:00Z",
  },
};

const route = (routes: Record<string, () => Response>) =>
  installMockFetch((url) => {
    const { pathname } = new URL(url);
    const handler = routes[pathname];
    return Promise.resolve(handler ? handler() : notFound());
  });

describe("detectProvider", () => {
  it("detects a migration to instatus without an html fetch", async () => {
    const fetchMock = route({ "/summary.json": () => json(instatusBody) });
    const result = await Effect.runPromise(
      detectProvider({
        statusPageUrl: PAGE_URL,
        currentProvider: "atlassian-statuspage",
        entryId: "test",
      }),
    );
    expect(result.currentProviderValidated).toBe(false);
    expect(result.matches.map((m) => m.provider)).toEqual(["instatus"]);
    expect(result.hostnameSuggestions).toEqual([]);
    expect(fetchMock.calls.length).toBe(3);
  });

  it("derives probe endpoints from urls with query or trailing slash", async () => {
    route({ "/summary.json": () => json(instatusBody) });
    const result = await Effect.runPromise(
      detectProvider({
        statusPageUrl: "https://status.example.com/?utm=1",
        currentProvider: "atlassian-statuspage",
      }),
    );
    expect(result.matches.map((m) => m.provider)).toEqual(["instatus"]);
  });

  it("short-circuits when the current provider still validates", async () => {
    const fetchMock = route({
      "/api/v2/summary.json": () => json(atlassianBody),
    });
    const result = await Effect.runPromise(
      detectProvider({
        statusPageUrl: PAGE_URL,
        currentProvider: "atlassian-statuspage",
      }),
    );
    expect(result.currentProviderValidated).toBe(true);
    expect(result.matches).toEqual([]);
    expect(fetchMock.calls.length).toBe(3);
  });

  it("accepts pair label drift: short-circuits even when the page is served by the api-identical peer", async () => {
    // Migrated atlassian → incident.io (or vice versa): the pair probe still
    // validates the current label, so detection ends without consulting the
    // html markers that would reveal the drift. Locked-in trade-off.
    const fetchMock = route({
      "/api/v2/summary.json": () => json(atlassianBody),
      "/": () => html('<script src="https://assets.incident.io/app.js">'),
    });
    const result = await Effect.runPromise(
      detectProvider({
        statusPageUrl: PAGE_URL,
        currentProvider: "atlassian-statuspage",
      }),
    );
    expect(result.currentProviderValidated).toBe(true);
    expect(result.matches).toEqual([]);
    expect(fetchMock.calls.length).toBe(3);
  });

  it("tiebreaks the ambiguous pair to atlassian via html marker", async () => {
    route({
      "/api/v2/summary.json": () => json(atlassianBody),
      "/": () => html('<link href="https://cdn.statuspage.io/foo.css">'),
    });
    const result = await Effect.runPromise(
      detectProvider({ statusPageUrl: PAGE_URL, currentProvider: "unknown" }),
    );
    expect(result.matches.map((m) => m.provider)).toEqual([
      "atlassian-statuspage",
    ]);
    expect(result.evidence).toContain("html marker: statuspage.io");
  });

  it("tiebreaks the ambiguous pair to incidentio via html marker", async () => {
    route({
      "/api/v2/summary.json": () => json(atlassianBody),
      "/": () => html('<script src="https://assets.incident.io/app.js">'),
    });
    const result = await Effect.runPromise(
      detectProvider({ statusPageUrl: PAGE_URL, currentProvider: "unknown" }),
    );
    expect(result.matches.map((m) => m.provider)).toEqual(["incidentio"]);
  });

  it("tiebreaks the ambiguous pair via the page hostname", async () => {
    route({
      "/api/v2/summary.json": () => json(atlassianBody),
      "/": () =>
        html("<html>no markers</html>", "https://example.statuspage.io/"),
    });
    const result = await Effect.runPromise(
      detectProvider({
        statusPageUrl: "https://example.statuspage.io",
        currentProvider: "unknown",
      }),
    );
    expect(result.matches.map((m) => m.provider)).toEqual([
      "atlassian-statuspage",
    ]);
    expect(result.evidence).toContain(
      "hostname tiebreak: atlassian-statuspage",
    );
  });

  it("keeps both pair candidates when markers are inconclusive", async () => {
    route({
      "/api/v2/summary.json": () => json(atlassianBody),
      "/": () => html("statuspage.io and incident.io"),
    });
    const result = await Effect.runPromise(
      detectProvider({ statusPageUrl: PAGE_URL, currentProvider: "unknown" }),
    );
    expect(result.matches.map((m) => m.provider)).toEqual([
      "atlassian-statuspage",
      "incidentio",
    ]);
  });

  it("keeps both pair candidates when the html fetch fails", async () => {
    route({ "/api/v2/summary.json": () => json(atlassianBody) });
    const result = await Effect.runPromise(
      detectProvider({ statusPageUrl: PAGE_URL, currentProvider: "unknown" }),
    );
    expect(result.matches.length).toBe(2);
    expect(result.evidence.some((e) => e.startsWith("html fetch failed"))).toBe(
      true,
    );
  });

  it("suggests uptime-robot from the page hostname when nothing validates", async () => {
    route({ "/xyz": () => html("<html>page</html>", "") });
    const result = await Effect.runPromise(
      detectProvider({
        statusPageUrl: "https://stats.uptimerobot.com/xyz",
        currentProvider: "atlassian-statuspage",
      }),
    );
    expect(result.matches).toEqual([]);
    expect(result.hostnameSuggestions).toEqual(["uptime-robot"]);
  });

  it("suggests via the redirect final url", async () => {
    route({
      "/": () => html("<html>page</html>", "https://stats.uptimerobot.com/xyz"),
    });
    const result = await Effect.runPromise(
      detectProvider({ statusPageUrl: PAGE_URL, currentProvider: "unknown" }),
    );
    expect(result.hostnameSuggestions).toEqual(["uptime-robot"]);
    expect(result.evidence).toContain(
      "final url https://stats.uptimerobot.com/xyz",
    );
  });

  it("never suggests the current provider from hostname evidence", async () => {
    route({ "/xyz": () => html("<html>page</html>", "") });
    const result = await Effect.runPromise(
      detectProvider({
        statusPageUrl: "https://stats.uptimerobot.com/xyz",
        currentProvider: "uptime-robot",
      }),
    );
    expect(result.hostnameSuggestions).toEqual([]);
  });
});
