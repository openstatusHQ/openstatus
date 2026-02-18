import { beforeEach, describe, expect, it, mock } from "bun:test";
import { InstatusFetcher } from "../../src/fetchers/instatus";
import type { StatusPageEntry } from "../../src/types";

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
    it("should fetch and parse UP status", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test Service",
        url: "https://test.com",
        status_page_url: "https://test.instatus.com",
        provider: "instatus",
        industry: ["saas"],
      };

      const mockResponse = {
        activeIncidents: [],
        activeMaintenances: [],
        status: {
          text: "All Systems Operational",
          type: "UP",
        },
        page: {
          name: "Test Service",
          url: "https://test.instatus.com",
          updated: "2024-02-16T12:00:00.000Z",
        },
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

      expect(result.severity).toBe("none");
      expect(result.description).toBe("All Systems Operational");
      expect(result.timezone).toBe("UTC");
      expect(typeof result.updated_at).toBe("number");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.instatus.com/summary.json",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "OpenStatus-Directory/1.0",
          }),
        }),
      );
    });

    it("should map HASISSUES to major indicator", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://test.instatus.com",
        provider: "instatus",
        industry: ["saas"],
      };

      const mockResponse = {
        activeIncidents: [{ id: 1, name: "API Errors" }],
        activeMaintenances: [],
        status: {
          text: "Service Degraded",
          type: "HASISSUES",
        },
        page: {
          name: "Test",
          url: "https://test.instatus.com",
          updated: "2024-02-16T12:00:00.000Z",
        },
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

      expect(result.severity).toBe("major");
      expect(result.description).toBe("Service Degraded");
    });

    it("should map UNDERMAINTENANCE to minor indicator", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://test.instatus.com",
        provider: "instatus",
        industry: ["saas"],
      };

      const mockResponse = {
        activeIncidents: [],
        activeMaintenances: [{ id: 1, name: "Scheduled Maintenance" }],
        status: {
          text: "Under Maintenance",
          type: "UNDERMAINTENANCE",
        },
        page: {
          name: "Test",
          url: "https://test.instatus.com",
          updated: "2024-02-16T12:00:00.000Z",
        },
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

      expect(result.severity).toBe("none");
      expect(result.description).toBe("Under Maintenance");
    });

    it("should use custom endpoint if provided", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://test.instatus.com",
        provider: "instatus",
        industry: ["saas"],
        api_config: {
          type: "instatus",
          endpoint: "https://custom.endpoint.com/status.json",
        },
      };

      const mockResponse = {
        activeIncidents: [],
        activeMaintenances: [],
        status: {
          text: "Operational",
          type: "UP",
        },
        page: {
          name: "Test",
          url: "https://test.instatus.com",
          updated: "2024-02-16T12:00:00.000Z",
        },
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      await fetcher.fetch(entry);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://custom.endpoint.com/status.json",
        expect.any(Object),
      );
    });

    it("should throw error on non-200 response", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://test.instatus.com",
        provider: "instatus",
        industry: ["saas"],
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        } as Response),
      );

      await expect(fetcher.fetch(entry)).rejects.toThrow(
        "HTTP 500: Internal Server Error",
      );
    });

    it("should throw error on invalid JSON schema", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://test.instatus.com",
        provider: "instatus",
        industry: ["saas"],
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ invalid: "data" }),
        } as Response),
      );

      await expect(fetcher.fetch(entry)).rejects.toThrow();
    });
  });
});
