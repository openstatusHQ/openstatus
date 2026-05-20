import { beforeEach, describe, expect, it, mock } from "bun:test";
import { UptimeRobotFetcher } from "../../src/fetchers/uptimerobot";
import type { StatusPageEntry } from "../../src/types";

const ENDPOINT =
  "https://status.example.com/api/getMonitorList/1234567-789012";

function makeEntry(
  overrides: Partial<StatusPageEntry> = {},
): StatusPageEntry {
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

function mockResponse(monitors: Array<Record<string, unknown>>) {
  global.fetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({ status: "ok", data: monitors }),
    } as Response),
  );
}

function monitor(
  statusClass: string,
  name = `monitor-${statusClass}`,
): Record<string, unknown> {
  return {
    monitorId: Math.floor(Math.random() * 1_000_000),
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

  beforeEach(() => {
    fetcher = new UptimeRobotFetcher();
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
      mockResponse([monitor("success"), monitor("success"), monitor("success")]);

      const result = await fetcher.fetch(makeEntry());

      expect(result.severity).toBe("none");
      expect(result.status).toBe("operational");
      expect(result.description).toBe("0 monitors down (3 total)");
      expect(result.timezone).toBe("UTC");
      expect(typeof result.updated_at).toBe("number");
      expect(global.fetch).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "OpenStatus-Directory/1.0",
          }),
        }),
      );
    });

    it("aggregates one warning among success → degraded", async () => {
      mockResponse([monitor("success"), monitor("warning"), monitor("success")]);

      const result = await fetcher.fetch(makeEntry());

      expect(result.severity).toBe("minor");
      expect(result.status).toBe("degraded");
      expect(result.description).toBe("1 monitors down (3 total)");
    });

    it("aggregates one danger among success → partial_outage", async () => {
      mockResponse([monitor("success"), monitor("danger"), monitor("success")]);

      const result = await fetcher.fetch(makeEntry());

      expect(result.severity).toBe("major");
      expect(result.status).toBe("partial_outage");
      expect(result.description).toBe("1 monitors down (3 total)");
    });

    it("aggregates danger + warning mix → partial_outage with both counted", async () => {
      mockResponse([
        monitor("success"),
        monitor("danger"),
        monitor("warning"),
        monitor("success"),
      ]);

      const result = await fetcher.fetch(makeEntry());

      expect(result.severity).toBe("major");
      expect(result.status).toBe("partial_outage");
      expect(result.description).toBe("2 monitors down (4 total)");
    });

    it("aggregates all danger → major_outage", async () => {
      mockResponse([monitor("danger"), monitor("danger"), monitor("danger")]);

      const result = await fetcher.fetch(makeEntry());

      expect(result.severity).toBe("major");
      expect(result.status).toBe("major_outage");
      expect(result.description).toBe("3 monitors down (3 total)");
    });

    it("single paused alongside healthy stays operational", async () => {
      mockResponse([monitor("success"), monitor("paused"), monitor("success")]);

      const result = await fetcher.fetch(makeEntry());

      expect(result.severity).toBe("none");
      expect(result.status).toBe("operational");
      expect(result.description).toBe("0 monitors down (3 total)");
    });

    it("all paused → under_maintenance", async () => {
      mockResponse([monitor("paused"), monitor("paused")]);

      const result = await fetcher.fetch(makeEntry());

      expect(result.severity).toBe("none");
      expect(result.status).toBe("under_maintenance");
      expect(result.description).toBe("2 monitors in maintenance (2 total)");
    });

    it("info treated as maintenance", async () => {
      mockResponse([monitor("info"), monitor("info")]);

      const result = await fetcher.fetch(makeEntry());

      expect(result.severity).toBe("none");
      expect(result.status).toBe("under_maintenance");
    });

    it("empty data array → operational", async () => {
      mockResponse([]);

      const result = await fetcher.fetch(makeEntry());

      expect(result.severity).toBe("none");
      expect(result.status).toBe("operational");
      expect(result.description).toBe("0 monitors down (0 total)");
    });

    it("unknown statusClass folds to operational with a warn", async () => {
      const warnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = warnSpy;

      mockResponse([monitor("success"), monitor("frobnicate"), monitor("success")]);

      try {
        const result = await fetcher.fetch(makeEntry());

        expect(result.severity).toBe("none");
        expect(result.status).toBe("operational");
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        console.warn = originalWarn;
      }
    });

    it("throws when api_config.endpoint is missing", async () => {
      const entry = makeEntry({
        api_config: { type: "uptimerobot" },
      });

      await expect(fetcher.fetch(entry)).rejects.toThrow(
        "UptimeRobot fetcher requires api_config.endpoint",
      );
    });

    it("throws on HTTP 500", async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        } as Response),
      );

      await expect(fetcher.fetch(makeEntry())).rejects.toThrow(
        "HTTP 500: Internal Server Error",
      );
    });

    it("throws on malformed JSON (missing data array)", async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ status: "ok" }),
        } as Response),
      );

      await expect(fetcher.fetch(makeEntry())).rejects.toThrow();
    });

    it("throws on wrong status field", async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ status: "error", data: [] }),
        } as Response),
      );

      await expect(fetcher.fetch(makeEntry())).rejects.toThrow();
    });
  });
});
