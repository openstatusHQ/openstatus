import { expect } from "@std/expect";
import { beforeEach, describe, it } from "@std/testing/bdd";

import { InstatusFetcher } from "../../src/fetchers/instatus";
import type { StatusPageEntry } from "../../src/types";
import {
  expectFetchError,
  installMockFetch,
  runFetcher,
  runFetcherExit,
} from "../helpers";

describe("InstatusFetcher", () => {
  let fetcher: InstatusFetcher;

  beforeEach(() => {
    fetcher = new InstatusFetcher();
  });

  describe("canHandle", () => {
    it("should identify entries with api_config.type = instatus", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "instatus" },
      };

      expect(fetcher.canHandle(entry)).toBe(true);
    });

    it("should identify entries with provider = instatus", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "instatus",
        industry: ["saas"],
      };

      expect(fetcher.canHandle(entry)).toBe(true);
    });

    it("should identify entries with instatus.com in URL", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://test.instatus.com",
        provider: "unknown",
        industry: ["saas"],
      };

      expect(fetcher.canHandle(entry)).toBe(true);
    });

    it("should not handle other providers", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "atlassian-statuspage",
        industry: ["saas"],
      };

      expect(fetcher.canHandle(entry)).toBe(false);
    });
  });

  describe("fetch", () => {
    const entry: StatusPageEntry = {
      id: "test",
      name: "Test Service",
      url: "https://test.com",
      status_page_url: "https://test.instatus.com",
      provider: "instatus",
      industry: ["saas"],
    };

    const mockJson = (body: unknown) =>
      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => body,
        } as Response),
      );

    it("should fetch and parse UP status (arrays omitted when empty)", async () => {
      const fetchMock = mockJson({
        page: {
          name: "Test Service",
          url: "https://test.instatus.com",
          status: "UP",
        },
      });

      const result = await runFetcher(fetcher, entry);

      expect(result.severity).toBe("none");
      expect(result.status).toBe("operational");
      expect(result.description).toBe("All Systems Operational");
      expect(result.timezone).toBe("UTC");
      expect(typeof result.updated_at).toBe("number");
      const call = fetchMock.calls[fetchMock.calls.length - 1];
      expect(call.args[0]).toBe("https://test.instatus.com/summary.json");
      expect(call.args[1]).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "OpenStatus-Directory/1.0",
          }),
        }),
      );
    });

    it("should map HASISSUES to the worst active incident impact", async () => {
      mockJson({
        page: {
          name: "Test",
          url: "https://test.instatus.com",
          status: "HASISSUES",
        },
        activeIncidents: [
          {
            name: "API Errors",
            started: "2024-02-16T12:00:00.000Z",
            status: "INVESTIGATING",
            impact: "DEGRADEDPERFORMANCE",
            url: "https://test.instatus.com/abc",
          },
          {
            name: "Dashboard Down",
            started: "2024-02-16T13:00:00.000Z",
            status: "IDENTIFIED",
            impact: "PARTIALOUTAGE",
            url: "https://test.instatus.com/def",
          },
        ],
        activeMaintenances: [],
      });

      const result = await runFetcher(fetcher, entry);

      expect(result.severity).toBe("major");
      expect(result.status).toBe("partial_outage");
      expect(result.description).toBe("API Errors, Dashboard Down");
      expect(result.updated_at).toBe(Date.parse("2024-02-16T13:00:00.000Z"));
    });

    it("should map HASISSUES without impact to minor/degraded", async () => {
      mockJson({
        page: {
          name: "Test",
          url: "https://test.instatus.com",
          status: "HASISSUES",
        },
        activeIncidents: [{ name: "Something" }],
      });

      const result = await runFetcher(fetcher, entry);

      expect(result.severity).toBe("minor");
      expect(result.status).toBe("degraded");
      expect(result.description).toBe("Something");
    });

    it("should ignore scheduled maintenance when deriving updated_at", async () => {
      const before = Date.now();
      mockJson({
        page: { name: "Test", url: "https://test.instatus.com", status: "UP" },
        activeMaintenances: [
          {
            name: "Upcoming DB upgrade",
            start: "2999-01-01T00:00:00.000Z",
            status: "NOTSTARTEDYET",
            duration: "120",
            url: "https://test.instatus.com/m",
          },
        ],
      });

      const result = await runFetcher(fetcher, entry);

      expect(result.status).toBe("operational");
      expect(result.updated_at).toBeGreaterThanOrEqual(before);
      expect(result.updated_at).toBeLessThanOrEqual(Date.now());
    });

    it("should map UNDERMAINTENANCE to under_maintenance", async () => {
      mockJson({
        page: {
          name: "Test",
          url: "https://test.instatus.com",
          status: "UNDERMAINTENANCE",
        },
        activeIncidents: [],
        activeMaintenances: [
          {
            name: "Scheduled Maintenance",
            start: "2024-02-16T12:00:00.000Z",
            status: "INPROGRESS",
            duration: "60",
            url: "https://test.instatus.com/m",
          },
        ],
      });

      const result = await runFetcher(fetcher, entry);

      expect(result.severity).toBe("none");
      expect(result.status).toBe("under_maintenance");
      expect(result.description).toBe("Scheduled Maintenance");
    });

    it("should use custom endpoint if provided", async () => {
      const fetchMock = mockJson({
        page: { name: "Test", url: "https://test.instatus.com", status: "UP" },
      });

      await runFetcher(fetcher, {
        ...entry,
        api_config: {
          type: "instatus",
          endpoint: "https://custom.endpoint.com/status.json",
        },
      });

      const call = fetchMock.calls[fetchMock.calls.length - 1];
      expect(call.args[0]).toBe("https://custom.endpoint.com/status.json");
      expect(call.args[1]).toEqual(expect.any(Object));
    });

    it("should fail with FetchError on non-200 response (after retries)", async () => {
      installMockFetch(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        } as Response),
      );

      const exit = await runFetcherExit(fetcher, entry);
      const err = expectFetchError(exit);
      expect(err.httpStatus).toBe(500);
    });

    it("should fail with FetchError on invalid JSON schema", async () => {
      mockJson({ invalid: "data" });

      const exit = await runFetcherExit(fetcher, entry);
      const err = expectFetchError(exit);
      expect(err.kind).toBe("schema");
      expect(err.cause).toBeInstanceOf(Error);
    });
  });
});
