import { beforeEach, describe, expect, it } from "bun:test";

import { AtlassianFetcher } from "../../src/fetchers/atlassian";
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

describe("AtlassianFetcher", () => {
  let fetcher: AtlassianFetcher;

  beforeEach(() => {
    fetcher = new AtlassianFetcher();
  });

  describe("canHandle", () => {
    it("should identify entries with api_config.type = atlassian", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "atlassian" },
      };

      expect(fetcher.canHandle(entry)).toBe(true);
    });

    it("should identify entries with provider = atlassian-statuspage", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "atlassian-statuspage",
        industry: ["saas"],
      };

      expect(fetcher.canHandle(entry)).toBe(true);
    });

    it("should identify entries with statuspage.io in URL", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://test.statuspage.io",
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
        provider: "instatus",
        industry: ["saas"],
      };

      expect(fetcher.canHandle(entry)).toBe(false);
    });
  });

  describe("fetch", () => {
    it("should fetch and parse status correctly", async () => {
      const entry: StatusPageEntry = {
        id: "github",
        name: "GitHub",
        url: "https://github.com",
        status_page_url: "https://www.githubstatus.com",
        provider: "atlassian-statuspage",
        industry: ["development-tools"],
        api_config: { type: "atlassian" },
      };

      const mockResponse = {
        page: {
          id: "abc123",
          name: "GitHub",
          url: "https://www.githubstatus.com",
          timezone: "Etc/UTC",
          updated_at: "2024-02-16T12:00:00.000Z",
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
      expect(result.description).toBe("All Systems Operational");
      expect(result.timezone).toBe("Etc/UTC");
      expect(typeof result.updated_at).toBe("number");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://www.githubstatus.com/api/v2/summary.json",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "OpenStatus-Directory/1.0",
          }),
        }),
      );
    });

    it("should handle status with optional time_zone", async () => {
      const entry: StatusPageEntry = {
        id: "openai",
        name: "OpenAI",
        url: "https://openai.com",
        status_page_url: "https://status.openai.com",
        provider: "atlassian-statuspage",
        industry: ["ai-ml"],
      };

      const mockResponse = {
        page: {
          id: "abc123",
          name: "OpenAI",
          url: "https://status.openai.com",
          updated_at: "2024-02-16T12:00:00.000Z",
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
        provider: "atlassian-statuspage",
        industry: ["saas"],
      };

      const mockResponse = {
        page: {
          id: "abc123",
          name: "Test",
          url: "https://status.test.com",
          timezone: "America/New_York",
          updated_at: "2024-02-16T12:00:00.000Z",
        },
        status: {
          indicator: "major",
          description: "Major Service Outage",
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
      expect(result.description).toBe("Major Service Outage");
    });

    it("should use custom endpoint if provided", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "atlassian-statuspage",
        industry: ["saas"],
        api_config: {
          type: "atlassian",
          endpoint: "https://custom.endpoint.com/status.json",
        },
      };

      const mockResponse = {
        page: {
          id: "abc123",
          name: "Test",
          url: "https://status.test.com",
          timezone: "UTC",
          updated_at: "2024-02-16T12:00:00.000Z",
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
        "https://custom.endpoint.com/status.json",
        expect.any(Object),
      );
    });

    it("should fail with FetchError on non-200 response", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "atlassian-statuspage",
        industry: ["saas"],
      };

      installMockFetch(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as Response),
      );

      const exit = await runFetcherExit(fetcher, entry);
      const err = expectFetchError(exit);
      expect(err.httpStatus).toBe(404);
      expect(err.fetcherName).toBe("atlassian");
      expect(err.entryId).toBe("test");
    });

    it("should fail with FetchError on invalid JSON schema", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "atlassian-statuspage",
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
      id: "github",
      name: "GitHub",
      url: "https://github.com",
      status_page_url: "https://www.githubstatus.com",
      provider: "atlassian-statuspage",
      industry: ["development-tools"],
      api_config: { type: "atlassian" },
    };

    it("normalizes incidents and preserves the raw payload", async () => {
      const mockResponse = {
        incidents: [
          {
            id: "abc",
            name: "API errors",
            status: "investigating",
            impact: "major",
            shortlink: "https://stspg.io/abc",
            started_at: "2024-02-16T11:00:00.000Z",
            created_at: "2024-02-16T12:00:00.000Z",
            resolved_at: null,
            extra_provider_field: { foo: 1, bar: ["x"] },
          },
          {
            id: "def",
            name: "Resolved blip",
            status: "resolved",
            created_at: "2024-02-15T08:00:00.000Z",
            resolved_at: "2024-02-15T08:30:00.000Z",
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
        "https://www.githubstatus.com/api/v2/incidents.json",
        expect.any(Object),
      );
      expect(incidents).toHaveLength(2);
      expect(incidents[0]).toMatchObject({
        providerIncidentId: "abc",
        name: "API errors",
        status: "investigating",
        impact: "major",
        shortlink: "https://stspg.io/abc",
        resolvedAt: null,
      });
      expect(incidents[0]?.startedAt).toBeInstanceOf(Date);
      expect(incidents[0]?.createdAt).toBeInstanceOf(Date);
      expect(incidents[0]?.raw).toMatchObject({
        id: "abc",
        extra_provider_field: { foo: 1, bar: ["x"] },
      });
      expect(incidents[1]).toMatchObject({
        providerIncidentId: "def",
        status: "resolved",
      });
      expect(incidents[1]?.resolvedAt).toBeInstanceOf(Date);
    });

    it("fails with FetchError on non-200", async () => {
      installMockFetch(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
        } as Response),
      );

      const exit = await runIncidentsExit(fetcher, entry);
      const err = expectIncidentsFetchError(exit);
      expect(err.httpStatus).toBe(503);
      expect(err.fetcherName).toBe("atlassian");
    });

    it("fails with FetchError on malformed payload", async () => {
      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ incidents: [{ no_id: true }] }),
        } as Response),
      );

      const exit = await runIncidentsExit(fetcher, entry);
      const err = expectIncidentsFetchError(exit);
      expect(err.cause).toBeInstanceOf(Error);
    });
  });
});
