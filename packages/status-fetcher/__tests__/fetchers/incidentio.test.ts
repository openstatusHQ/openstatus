import { beforeEach, describe, expect, it } from "bun:test";
import { IncidentioFetcher } from "../../src/fetchers/incidentio";
import type { StatusPageEntry } from "../../src/types";
import {
  expectFetchError,
  installMockFetch,
  runFetcher,
  runFetcherExit,
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
    it("should fetch and parse operational status (no incidents)", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test Service",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "incidentio",
        industry: ["saas"],
      };

      const mockResponse = {
        ongoing_incidents: [],
        in_progress_maintenances: [],
        scheduled_maintenances: [],
      };

      const fetchMock = installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);

      expect(result.severity).toBe("none");
      expect(result.description).toBe("All Systems Operational");
      expect(result.timezone).toBe("UTC");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://status.test.com/api/widget",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "OpenStatus-Directory/1.0",
            Accept: "application/json",
          }),
        }),
      );
    });

    it("should handle ongoing incidents with investigating status", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "incidentio",
        industry: ["saas"],
      };

      const mockResponse = {
        ongoing_incidents: [
          {
            id: "123",
            name: "API Errors",
            status: "investigating",
            last_update: {
              message: "We are investigating",
              updated_at: "2024-02-16T12:00:00.000Z",
            },
          },
        ],
        in_progress_maintenances: [],
        scheduled_maintenances: [],
      };

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);

      expect(result.severity).toBe("major");
      expect(result.description).toBe("Incident: API Errors");
    });

    it("should handle ongoing incidents with monitoring status", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "incidentio",
        industry: ["saas"],
      };

      const mockResponse = {
        ongoing_incidents: [
          {
            id: "123",
            name: "Database Slowness",
            status: "monitoring",
            last_update: {
              message: "Monitoring the fix",
              updated_at: "2024-02-16T12:00:00.000Z",
            },
          },
        ],
        in_progress_maintenances: [],
        scheduled_maintenances: [],
      };

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);

      expect(result.severity).toBe("minor");
      expect(result.description).toBe("Monitoring: Database Slowness");
    });

    it("should handle in-progress maintenance", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "incidentio",
        industry: ["saas"],
      };

      const mockResponse = {
        ongoing_incidents: [],
        in_progress_maintenances: [
          {
            id: "456",
            name: "Database Upgrade",
            status: "in_progress",
            last_update: {
              message: "Maintenance in progress",
              updated_at: "2024-02-16T12:00:00.000Z",
            },
          },
        ],
        scheduled_maintenances: [],
      };

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);

      expect(result.severity).toBe("none");
      expect(result.description).toBe("Maintenance: Database Upgrade");
    });

    it("should handle scheduled maintenance", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "incidentio",
        industry: ["saas"],
      };

      const mockResponse = {
        ongoing_incidents: [],
        in_progress_maintenances: [],
        scheduled_maintenances: [
          {
            id: "789",
            name: "Server Maintenance",
            status: "scheduled",
            last_update: {
              message: "Scheduled for tomorrow",
              updated_at: "2024-02-16T12:00:00.000Z",
            },
          },
        ],
      };

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);

      expect(result.severity).toBe("none");
      expect(result.description).toBe(
        "All Systems Operational (Scheduled: Server Maintenance)",
      );
    });

    it("should prioritize ongoing incidents over maintenance", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "incidentio",
        industry: ["saas"],
      };

      const mockResponse = {
        ongoing_incidents: [
          {
            id: "123",
            name: "Critical Issue",
            status: "investigating",
            last_update: {
              message: "Investigating",
              updated_at: "2024-02-16T12:00:00.000Z",
            },
          },
        ],
        in_progress_maintenances: [
          {
            id: "456",
            name: "Maintenance",
            status: "in_progress",
            last_update: {
              message: "In progress",
              updated_at: "2024-02-16T12:00:00.000Z",
            },
          },
        ],
        scheduled_maintenances: [],
      };

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);

      expect(result.severity).toBe("major");
      expect(result.description).toBe("Incident: Critical Issue");
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
          endpoint: "https://custom.endpoint.com/widget",
        },
      };

      const mockResponse = {
        ongoing_incidents: [],
        in_progress_maintenances: [],
        scheduled_maintenances: [],
      };

      const fetchMock = installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      await runFetcher(fetcher, entry);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://custom.endpoint.com/widget",
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
    });
  });
});
