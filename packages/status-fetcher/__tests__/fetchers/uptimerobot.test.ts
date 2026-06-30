import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { spy } from "@std/testing/mock";

import { UptimeRobotFetcher } from "../../src/fetchers/uptimerobot";
import type { StatusPageEntry } from "../../src/types";
import {
  expectFetchError,
  installMockFetch,
  runFetcher,
  runFetcherExit,
} from "../helpers";

const ENDPOINT = "https://status.example.com/api/getMonitorList/1234567-789012";

type MonitorFixture = {
  monitorId: number;
  name: string;
  statusClass: string;
  url: string | null;
  type: string;
  ratio: { ratio: string; label: string; color: string };
  "30dRatio": { ratio: string; label: string; color: string };
  "90dRatio": { ratio: string; label: string; color: string };
  hasIncidentComments: boolean;
  lastDowntime: null;
};

function makeEntry(overrides: Partial<StatusPageEntry> = {}): StatusPageEntry {
  return {
    id: "test",
    name: "Test Service",
    url: "https://example.com",
    status_page_url: "https://status.example.com",
    provider: "uptime-robot",
    industry: ["saas"],
    api_config: { type: "uptimerobot", endpoint: ENDPOINT },
    ...overrides,
  };
}

function mockResponseWith(monitors: MonitorFixture[]) {
  return installMockFetch(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({ status: "ok", data: monitors }),
    } as Response),
  );
}

let monitorIdCounter = 0;
function monitor(
  statusClass: string,
  name = `monitor-${statusClass}`,
): MonitorFixture {
  monitorIdCounter++;
  return {
    monitorId: monitorIdCounter,
    name,
    statusClass,
    url: null,
    type: "HTTP(s)",
    ratio: { ratio: "99.999", label: "excellent", color: "green" },
    "30dRatio": { ratio: "99.999", label: "excellent", color: "green" },
    "90dRatio": { ratio: "99.999", label: "excellent", color: "green" },
    hasIncidentComments: false,
    lastDowntime: null,
  };
}

describe("UptimeRobotFetcher", () => {
  let fetcher: UptimeRobotFetcher;
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetcher = new UptimeRobotFetcher();
    monitorIdCounter = 0;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("canHandle", () => {
    it("matches api_config.type = uptimerobot", () => {
      expect(
        fetcher.canHandle(
          makeEntry({
            provider: "unknown",
            api_config: { type: "uptimerobot", endpoint: ENDPOINT },
          }),
        ),
      ).toBe(true);
    });

    it("matches provider = uptime-robot", () => {
      expect(
        fetcher.canHandle(
          makeEntry({ provider: "uptime-robot", api_config: undefined }),
        ),
      ).toBe(true);
    });

    it("does not match on hostname alone", () => {
      expect(
        fetcher.canHandle(
          makeEntry({
            provider: "unknown",
            status_page_url: "https://status.uptimerobot.com",
            api_config: undefined,
          }),
        ),
      ).toBe(false);
    });

    it("does not match unrelated providers", () => {
      expect(
        fetcher.canHandle(
          makeEntry({
            provider: "atlassian-statuspage",
            api_config: { type: "atlassian" },
          }),
        ),
      ).toBe(false);
    });
  });

  describe("fetch", () => {
    it("aggregates all success → operational", async () => {
      const fetchMock = mockResponseWith([
        monitor("success"),
        monitor("success"),
        monitor("success"),
      ]);

      const result = await runFetcher(fetcher, makeEntry());

      expect(result.severity).toBe("none");
      expect(result.status).toBe("operational");
      expect(result.description).toBe("0 monitors down (3 total)");
      expect(result.timezone).toBe("UTC");
      expect(typeof result.updated_at).toBe("number");
      const lastCall = fetchMock.calls[fetchMock.calls.length - 1];
      expect(lastCall.args[0]).toBe(ENDPOINT);
      expect(lastCall.args[1]).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "OpenStatus-Directory/1.0",
          }),
        }),
      );
    });

    it("aggregates one warning among success → degraded", async () => {
      mockResponseWith([
        monitor("success"),
        monitor("warning"),
        monitor("success"),
      ]);

      const result = await runFetcher(fetcher, makeEntry());

      expect(result.severity).toBe("minor");
      expect(result.status).toBe("degraded");
      expect(result.description).toBe("1 monitor degraded (3 total)");
    });

    it("aggregates two warnings among success → degraded (plural)", async () => {
      mockResponseWith([
        monitor("success"),
        monitor("warning"),
        monitor("warning"),
        monitor("success"),
      ]);

      const result = await runFetcher(fetcher, makeEntry());

      expect(result.status).toBe("degraded");
      expect(result.description).toBe("2 monitors degraded (4 total)");
    });

    it("aggregates one danger among success → partial_outage", async () => {
      mockResponseWith([
        monitor("success"),
        monitor("danger"),
        monitor("success"),
      ]);

      const result = await runFetcher(fetcher, makeEntry());

      expect(result.severity).toBe("major");
      expect(result.status).toBe("partial_outage");
      expect(result.description).toBe("1 monitor down (3 total)");
    });

    it("aggregates danger + warning mix → partial_outage with separated counts", async () => {
      mockResponseWith([
        monitor("success"),
        monitor("danger"),
        monitor("warning"),
        monitor("success"),
      ]);

      const result = await runFetcher(fetcher, makeEntry());

      expect(result.severity).toBe("major");
      expect(result.status).toBe("partial_outage");
      expect(result.description).toBe("1 down, 1 degraded (4 total)");
    });

    it("aggregates all danger → major_outage", async () => {
      mockResponseWith([
        monitor("danger"),
        monitor("danger"),
        monitor("danger"),
      ]);

      const result = await runFetcher(fetcher, makeEntry());

      expect(result.severity).toBe("major");
      expect(result.status).toBe("major_outage");
      expect(result.description).toBe("All 3 monitors down");
    });

    it("single monitor all down → major_outage with singular wording", async () => {
      mockResponseWith([monitor("danger")]);

      const result = await runFetcher(fetcher, makeEntry());

      expect(result.status).toBe("major_outage");
      expect(result.description).toBe("1 monitor down (1 total)");
    });

    it("single paused alongside healthy stays operational", async () => {
      mockResponseWith([
        monitor("success"),
        monitor("paused"),
        monitor("success"),
      ]);

      const result = await runFetcher(fetcher, makeEntry());

      expect(result.severity).toBe("none");
      expect(result.status).toBe("operational");
      expect(result.description).toBe("0 monitors down (3 total)");
    });

    it("all paused → under_maintenance", async () => {
      mockResponseWith([monitor("paused"), monitor("paused")]);

      const result = await runFetcher(fetcher, makeEntry());

      expect(result.severity).toBe("none");
      expect(result.status).toBe("under_maintenance");
      expect(result.description).toBe("2 monitors in maintenance (2 total)");
    });

    it("info treated as maintenance", async () => {
      mockResponseWith([monitor("info"), monitor("info")]);

      const result = await runFetcher(fetcher, makeEntry());

      expect(result.severity).toBe("none");
      expect(result.status).toBe("under_maintenance");
    });

    it("empty data array → operational", async () => {
      mockResponseWith([]);

      const result = await runFetcher(fetcher, makeEntry());

      expect(result.severity).toBe("none");
      expect(result.status).toBe("operational");
      expect(result.description).toBe("0 monitors down (0 total)");
    });

    it("unknown statusClass folds to operational with a warn", async () => {
      const warnSpy = spy(() => {});
      const originalWarn = console.warn;
      console.warn = warnSpy;

      mockResponseWith([
        monitor("success"),
        monitor("frobnicate"),
        monitor("success"),
      ]);

      try {
        const result = await runFetcher(fetcher, makeEntry());

        expect(result.severity).toBe("none");
        expect(result.status).toBe("operational");
        expect(warnSpy.calls.length).toBeGreaterThan(0);
      } finally {
        console.warn = originalWarn;
      }
    });

    it("fails with FetchError when api_config.endpoint is missing", async () => {
      const entry = makeEntry({
        api_config: { type: "uptimerobot" },
      });

      const exit = await runFetcherExit(fetcher, entry);
      const err = expectFetchError(exit);
      if (!(err.cause instanceof Error)) {
        throw new Error("expected Error cause");
      }
      expect(err.cause.message).toContain(
        "UptimeRobot fetcher requires api_config.endpoint",
      );
    });

    it("fails with FetchError on HTTP 500", async () => {
      installMockFetch(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        } as Response),
      );

      const exit = await runFetcherExit(fetcher, makeEntry());
      const err = expectFetchError(exit);
      expect(err.httpStatus).toBe(500);
    });

    it("fails with FetchError on malformed JSON (missing data array)", async () => {
      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ status: "ok" }),
        } as Response),
      );

      const exit = await runFetcherExit(fetcher, makeEntry());
      const err = expectFetchError(exit);
      expect(err.cause).toBeInstanceOf(Error);
    });

    it("fails with FetchError on wrong status field", async () => {
      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ status: "error", data: [] }),
        } as Response),
      );

      const exit = await runFetcherExit(fetcher, makeEntry());
      const err = expectFetchError(exit);
      expect(err.cause).toBeInstanceOf(Error);
    });
  });
});
