import { beforeEach, describe, expect, it, mock } from "bun:test";
import { BetterStackFetcher } from "../../src/fetchers/betterstack";
import type { StatusPageEntry } from "../../src/types";

describe("BetterStackFetcher", () => {
  let fetcher: BetterStackFetcher;

  beforeEach(() => {
    fetcher = new BetterStackFetcher();
  });

  describe("canHandle", () => {
    it("should identify entries with api_config.type = betterstack", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "betterstack" },
      };

      expect(fetcher.canHandle(entry)).toBe(true);
    });

    it("should identify entries with provider = better-uptime", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "better-uptime",
        industry: ["saas"],
      };

      expect(fetcher.canHandle(entry)).toBe(true);
    });

    it("should identify entries with betteruptime.com in URL", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.betteruptime.com",
        provider: "unknown",
        industry: ["saas"],
      };

      expect(fetcher.canHandle(entry)).toBe(true);
    });

    it("should identify entries with betterstack.com in URL", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.betterstack.com",
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
        provider: "better-uptime",
        industry: ["saas"],
      };

      const mockResponse = {
        data: {
          id: "123",
          type: "status_page",
          attributes: {
            company_name: "Test Service",
            timezone: "America/New_York",
            aggregate_state: "operational",
            updated_at: "2024-02-16T12:00:00.000Z",
          },
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
      expect(result.timezone).toBe("America/New_York");
      expect(typeof result.updated_at).toBe("number");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://status.test.com/index.json",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "OpenStatus-Directory/1.0",
            Accept: "application/json",
          }),
        }),
      );
    });

    it("should map degraded state to minor indicator", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "better-uptime",
        industry: ["saas"],
      };

      const mockResponse = {
        data: {
          id: "123",
          type: "status_page",
          attributes: {
            company_name: "Test",
            timezone: "UTC",
            aggregate_state: "degraded",
            updated_at: "2024-02-16T12:00:00.000Z",
          },
        },
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

      expect(result.severity).toBe("minor");
      expect(result.description).toBe("Degraded Service");
    });

    it("should map downtime state to major indicator", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "better-uptime",
        industry: ["saas"],
      };

      const mockResponse = {
        data: {
          id: "123",
          type: "status_page",
          attributes: {
            company_name: "Test",
            timezone: "UTC",
            aggregate_state: "downtime",
            updated_at: "2024-02-16T12:00:00.000Z",
          },
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
      expect(result.description).toBe("Service Outage");
    });

    it("should use custom endpoint if provided", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "better-uptime",
        industry: ["saas"],
        api_config: {
          type: "betterstack",
          endpoint: "https://custom.endpoint.com/status.json",
        },
      };

      const mockResponse = {
        data: {
          id: "123",
          type: "status_page",
          attributes: {
            company_name: "Test",
            timezone: "UTC",
            aggregate_state: "operational",
            updated_at: "2024-02-16T12:00:00.000Z",
          },
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
        status_page_url: "https://status.test.com",
        provider: "better-uptime",
        industry: ["saas"],
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 403,
          statusText: "Forbidden",
        } as Response),
      );

      await expect(fetcher.fetch(entry)).rejects.toThrow("HTTP 403: Forbidden");
    });

    it("should throw error on invalid JSON schema", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "better-uptime",
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
