import { beforeEach, describe, expect, it } from "bun:test";

import { IncidentioFetcher } from "../../src/fetchers/incidentio";
import type { StatusPageEntry } from "../../src/types";
import {
  expectFetchError,
  expectIncidentsFetchError,
  installMockFetch,
  runFetcher,
  runFetcherExit,
  runIncidents,
  runIncidentsExit,
} from "../helpers";

describe("IncidentioFetcher", () => {
  let fetcher: IncidentioFetcher;

  beforeEach(() => {
    fetcher = new IncidentioFetcher();
  });

  describe("canHandle", () => {
    it("should identify entries with api_config.type = incidentio", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "incidentio" },
      };

      expect(fetcher.canHandle(entry)).toBe(true);
    });

    it("should identify entries with provider = incidentio", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "incidentio",
        industry: ["saas"],
      };

      expect(fetcher.canHandle(entry)).toBe(true);
    });

    it("should identify entries with incident.io in URL", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.incident.io",
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
    it("should fetch and parse operational status", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test Service",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "incidentio",
        industry: ["saas"],
      };

      const mockResponse = {
        page: {
          id: "01GX91T1T0RXR54F1EKBQMAYCJ",
          name: "Test Service",
          url: "https://status.test.com",
          updated_at: "2024-02-16T12:00:00Z",
        },
        status: {
          indicator: "none",
          description: "All Systems Operational",
        },
      };

      const fetchMock = installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);

      expect(result.severity).toBe("none");
      expect(result.status).toBe("operational");
      expect(result.description).toBe("All Systems Operational");
      expect(typeof result.updated_at).toBe("number");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://status.test.com/api/v2/summary.json",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "OpenStatus-Directory/1.0",
            Accept: "application/json",
          }),
        }),
      );
    });

    it("should handle a response without timezone", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "incidentio",
        industry: ["saas"],
      };

      const mockResponse = {
        page: {
          id: "01GX91T1T0RXR54F1EKBQMAYCJ",
          name: "Test",
          url: "https://status.test.com",
          updated_at: "2024-02-16T12:00:00Z",
        },
        status: {
          indicator: "minor",
          description: "Elevated Error Rates",
        },
      };

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);

      expect(result.severity).toBe("minor");
      expect(result.description).toBe("Elevated Error Rates");
      expect(result.timezone).toBeUndefined();
    });

    it("should handle major incidents", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "incidentio",
        industry: ["saas"],
      };

      const mockResponse = {
        page: {
          id: "01GX91T1T0RXR54F1EKBQMAYCJ",
          name: "Test",
          url: "https://status.test.com",
          timezone: "America/New_York",
          updated_at: "2024-02-16T12:00:00Z",
        },
        status: {
          indicator: "major",
          description: "Investigating API Errors",
        },
      };

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);

      expect(result.severity).toBe("major");
      expect(result.status).toBe("investigating");
      expect(result.description).toBe("Investigating API Errors");
      expect(result.timezone).toBe("America/New_York");
    });

    it("should use custom endpoint if provided", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "incidentio",
        industry: ["saas"],
        api_config: {
          type: "incidentio",
          endpoint: "https://custom.endpoint.com/summary.json",
        },
      };

      const mockResponse = {
        page: {
          id: "01GX91T1T0RXR54F1EKBQMAYCJ",
          name: "Test",
          url: "https://status.test.com",
          updated_at: "2024-02-16T12:00:00Z",
        },
        status: {
          indicator: "none",
          description: "All Systems Operational",
        },
      };

      const fetchMock = installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      await runFetcher(fetcher, entry);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://custom.endpoint.com/summary.json",
        expect.any(Object),
      );
    });

    it("should fail with FetchError on 5xx response", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "incidentio",
        industry: ["saas"],
      };

      installMockFetch(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
        } as Response),
      );

      const exit = await runFetcherExit(fetcher, entry);
      const err = expectFetchError(exit);
      expect(err.httpStatus).toBe(503);
      expect(err.fetcherName).toBe("incidentio");
    });

    it("should fail with FetchError on invalid JSON schema", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "incidentio",
        industry: ["saas"],
      };

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ invalid: "data" }),
        } as Response),
      );

      const exit = await runFetcherExit(fetcher, entry);
      const err = expectFetchError(exit);
      expect(err.cause).toBeInstanceOf(Error);
    });
  });

  describe("fetchIncidents", () => {
    const entry: StatusPageEntry = {
      id: "linear",
      name: "Linear",
      url: "https://linear.app",
      status_page_url: "https://status.linear.app",
      provider: "incidentio",
      industry: ["development-tools"],
      api_config: { type: "incidentio" },
    };

    it("normalizes incident.io payloads", async () => {
      const mockResponse = {
        incidents: [
          {
            id: "INC-1",
            name: "Login degraded",
            status: "monitoring",
            impact: "minor",
            created_at: "2024-05-01T10:00:00.000Z",
            started_at: "2024-05-01T09:55:00.000Z",
            resolved_at: null,
            severity: "low",
          },
        ],
      };

      const fetchMock = installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const incidents = await runIncidents(fetcher, entry);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://status.linear.app/api/v2/incidents.json",
        expect.any(Object),
      );
      expect(incidents).toHaveLength(1);
      expect(incidents[0]).toMatchObject({
        providerIncidentId: "INC-1",
        name: "Login degraded",
        status: "monitoring",
        impact: "minor",
        resolvedAt: null,
      });
      expect(incidents[0]?.raw).toMatchObject({
        id: "INC-1",
        severity: "low",
      });
    });

    it("returns an empty list when upstream sends no incidents", async () => {
      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ incidents: [] }),
        } as Response),
      );
      const incidents = await runIncidents(fetcher, entry);
      expect(incidents).toEqual([]);
    });

    it("fails with FetchError on non-200", async () => {
      installMockFetch(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Server Error",
        } as Response),
      );
      const exit = await runIncidentsExit(fetcher, entry);
      const err = expectIncidentsFetchError(exit);
      expect(err.httpStatus).toBe(500);
      expect(err.fetcherName).toBe("incidentio");
    });
  });
});
