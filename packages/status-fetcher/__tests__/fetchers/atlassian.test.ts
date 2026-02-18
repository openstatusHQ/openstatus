import { beforeEach, describe, expect, it, mock } from "bun:test";
import { AtlassianFetcher } from "../../src/fetchers/atlassian";
import type { StatusPageEntry } from "../../src/types";

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

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

      expect(result.severity).toBe("none");
      expect(result.description).toBe("All Systems Operational");
      expect(result.timezone).toBe("Etc/UTC");
      expect(typeof result.updated_at).toBe("number");
      expect(global.fetch).toHaveBeenCalledWith(
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

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

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

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

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
        provider: "atlassian-statuspage",
        industry: ["saas"],
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as Response),
      );

      await expect(fetcher.fetch(entry)).rejects.toThrow("HTTP 404: Not Found");
    });

    it("should throw error on invalid JSON schema", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "atlassian-statuspage",
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
