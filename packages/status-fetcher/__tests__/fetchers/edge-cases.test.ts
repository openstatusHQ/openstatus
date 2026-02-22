import { describe, expect, it, mock } from "bun:test";
import { AtlassianFetcher } from "../../src/fetchers/atlassian";
import { BetterStackFetcher } from "../../src/fetchers/betterstack";
import { CustomApiFetcher } from "../../src/fetchers/custom";
import { HtmlScraperFetcher } from "../../src/fetchers/html";
import { InstatusFetcher } from "../../src/fetchers/instatus";
import type { StatusPageEntry } from "../../src/types";

describe("Fetcher Edge Cases", () => {
  describe("Network Errors", () => {
    it("should handle fetch network errors", async () => {
      const fetcher = new AtlassianFetcher();
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "atlassian-statuspage",
        industry: ["saas"],
      };

      global.fetch = mock(() => Promise.reject(new Error("Network error")));

      await expect(fetcher.fetch(entry)).rejects.toThrow("Network error");
    });

    it("should handle timeout errors", async () => {
      const fetcher = new InstatusFetcher();
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://test.instatus.com",
        provider: "instatus",
        industry: ["saas"],
      };

      global.fetch = mock(() => Promise.reject(new Error("Request timeout")));

      await expect(fetcher.fetch(entry)).rejects.toThrow("Request timeout");
    });
  });

  describe("Malformed JSON Responses", () => {
    it("should handle invalid JSON in Atlassian response", async () => {
      const fetcher = new AtlassianFetcher();
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
          json: async () => {
            throw new SyntaxError("Invalid JSON");
          },
        } as unknown as Response),
      );

      await expect(fetcher.fetch(entry)).rejects.toThrow("Invalid JSON");
    });

    it("should handle missing required fields in BetterStack response", async () => {
      const fetcher = new BetterStackFetcher();
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "better-uptime",
        industry: ["saas"],
      };

      // Missing data.attributes
      const malformedResponse = {
        data: {
          id: "123",
          type: "status_page",
        },
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => malformedResponse,
        } as Response),
      );

      await expect(fetcher.fetch(entry)).rejects.toThrow();
    });

    it("should handle empty response", async () => {
      const fetcher = new InstatusFetcher();
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
          json: async () => ({}),
        } as Response),
      );

      await expect(fetcher.fetch(entry)).rejects.toThrow();
    });
  });

  describe("Invalid Status Values", () => {
    it("should handle unknown indicator values in Atlassian", async () => {
      const fetcher = new AtlassianFetcher();
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
          id: "123",
          name: "Test",
          url: "https://status.test.com",
          timezone: "UTC",
          updated_at: "2024-02-16T12:00:00.000Z",
        },
        status: {
          indicator: "unknown", // Invalid value
          description: "Unknown Status",
        },
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      await expect(fetcher.fetch(entry)).rejects.toThrow();
    });

    it("should handle unknown status type in Instatus", async () => {
      const fetcher = new InstatusFetcher();
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
        activeMaintenances: [],
        status: {
          text: "Unknown",
          type: "UNKNOWN", // Invalid type
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

      await expect(fetcher.fetch(entry)).rejects.toThrow();
    });
  });

  describe("HTML Parser Edge Cases", () => {
    it("should handle malformed HTML", async () => {
      const fetcher = new HtmlScraperFetcher();
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "html-scraper" },
      };

      const malformedHtml = "<html><body><div class='status'>Unclosed div";

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: async () => malformedHtml,
        } as Response),
      );

      // Should not throw, but return Unknown
      const result = await fetcher.fetch(entry);
      expect(result.description).toBe("Unknown");
      expect(result.severity).toBe("none");
      expect(result.status).toBe("operational");
    });

    it("should handle empty HTML", async () => {
      const fetcher = new HtmlScraperFetcher();
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "html-scraper" },
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: async () => "",
        } as Response),
      );

      const result = await fetcher.fetch(entry);
      expect(result.description).toBe("Unknown");
      expect(result.severity).toBe("none");
    });

    it("should handle HTML with no status indicators", async () => {
      const fetcher = new HtmlScraperFetcher();
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "html-scraper" },
      };

      const htmlWithNoStatus = `
        <html>
          <body>
            <h1>Welcome</h1>
            <p>This is a page</p>
          </body>
        </html>
      `;

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: async () => htmlWithNoStatus,
        } as Response),
      );

      const result = await fetcher.fetch(entry);
      expect(result.description).toBe("Unknown");
    });
  });

  describe("Custom API Edge Cases", () => {
    it("should handle missing endpoint configuration", async () => {
      const fetcher = new CustomApiFetcher();
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "custom",
        industry: ["saas"],
        api_config: { type: "custom" }, // Missing endpoint
      };

      await expect(fetcher.fetch(entry)).rejects.toThrow(
        "Custom API requires explicit endpoint configuration",
      );
    });

    it("should handle AWS parser (not implemented)", async () => {
      const fetcher = new CustomApiFetcher();
      const entry: StatusPageEntry = {
        id: "aws",
        name: "AWS",
        url: "https://aws.amazon.com",
        status_page_url: "https://status.aws.amazon.com",
        provider: "custom",
        industry: ["cloud-providers"],
        api_config: {
          type: "custom",
          endpoint: "https://status.aws.amazon.com/data.json",
          parser: "aws",
        },
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({}),
        } as Response),
      );

      await expect(fetcher.fetch(entry)).rejects.toThrow(
        "AWS parser not implemented - uses RSS feeds",
      );
    });

    it("should handle generic parser with minimal data", async () => {
      const fetcher = new CustomApiFetcher();
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "custom",
        industry: ["saas"],
        api_config: {
          type: "custom",
          endpoint: "https://api.test.com/status",
        },
      };

      const minimalResponse = { status: "ok" };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => minimalResponse,
        } as Response),
      );

      const result = await fetcher.fetch(entry);
      expect(result.severity).toBe("none");
      expect(result.status).toBe("operational");
    });
  });

  describe("HTTP Error Codes", () => {
    const testCases = [
      { code: 400, text: "Bad Request" },
      { code: 401, text: "Unauthorized" },
      { code: 403, text: "Forbidden" },
      { code: 404, text: "Not Found" },
      { code: 429, text: "Too Many Requests" },
      { code: 500, text: "Internal Server Error" },
      { code: 502, text: "Bad Gateway" },
      { code: 503, text: "Service Unavailable" },
    ];

    testCases.forEach(({ code, text }) => {
      it(`should handle ${code} ${text}`, async () => {
        const fetcher = new AtlassianFetcher();
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
            status: code,
            statusText: text,
          } as Response),
        );

        await expect(fetcher.fetch(entry)).rejects.toThrow(`${code}`);
      });
    });
  });

  describe("Date/Timestamp Edge Cases", () => {
    it("should handle invalid date strings", async () => {
      const fetcher = new AtlassianFetcher();
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
          id: "123",
          name: "Test",
          url: "https://status.test.com",
          timezone: "UTC",
          updated_at: "not-a-date", // Invalid date
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

      await expect(fetcher.fetch(entry)).rejects.toThrow();
    });

    it("should handle Slack API with string timestamp", async () => {
      const fetcher = new CustomApiFetcher();
      const entry: StatusPageEntry = {
        id: "slack",
        name: "Slack",
        url: "https://slack.com",
        status_page_url: "https://slack-status.com",
        provider: "custom",
        industry: ["communication"],
        api_config: {
          type: "custom",
          endpoint: "https://slack-status.com/api/v2.0.0/current",
          parser: "slack",
        },
      };

      const mockResponse = {
        status: "ok",
        date_created: "2024-02-16T12:00:00.000Z",
        date_updated: "2024-02-16T13:00:00.000Z",
        active_incidents: [],
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      // Should handle string timestamps by parsing them
      const result = await fetcher.fetch(entry);
      expect(result.severity).toBe("none");
      expect(result.status).toBe("operational");
      expect(typeof result.updated_at).toBe("number");
    });
  });
});
