import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { Exit } from "effect";

import { AtlassianFetcher } from "../../src/fetchers/atlassian";
import { BetterStackFetcher } from "../../src/fetchers/betterstack";
import { CustomApiFetcher } from "../../src/fetchers/custom";
import { HtmlScraperFetcher } from "../../src/fetchers/html";
import { InstatusFetcher } from "../../src/fetchers/instatus";
import type { StatusPageEntry } from "../../src/types";
import {
  expectFetchError,
  installMockFetch,
  runFetcher,
  runFetcherExit,
} from "../helpers";

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

      installMockFetch(() => Promise.reject(new Error("Network error")));

      const exit = await runFetcherExit(fetcher, entry);
      const err = expectFetchError(exit);
      if (!(err.cause instanceof Error)) {
        throw new Error("expected Error cause");
      }
      expect(err.cause.message).toContain("Network error");
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

      installMockFetch(() => Promise.reject(new Error("Request timeout")));

      const exit = await runFetcherExit(fetcher, entry);
      expect(Exit.isFailure(exit)).toBe(true);
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

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => {
            throw new SyntaxError("Invalid JSON");
          },
        } as unknown as Response),
      );

      const exit = await runFetcherExit(fetcher, entry);
      const err = expectFetchError(exit);
      if (!(err.cause instanceof Error)) {
        throw new Error("expected Error cause");
      }
      expect(err.cause.message).toContain("Invalid JSON");
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

      const malformedResponse = {
        data: {
          id: "123",
          type: "status_page",
        },
      };

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => malformedResponse,
        } as Response),
      );

      const exit = await runFetcherExit(fetcher, entry);
      expect(Exit.isFailure(exit)).toBe(true);
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

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({}),
        } as Response),
      );

      const exit = await runFetcherExit(fetcher, entry);
      expect(Exit.isFailure(exit)).toBe(true);
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
          indicator: "unknown",
          description: "Unknown Status",
        },
      };

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const exit = await runFetcherExit(fetcher, entry);
      expect(Exit.isFailure(exit)).toBe(true);
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
          type: "UNKNOWN",
        },
        page: {
          name: "Test",
          url: "https://test.instatus.com",
          updated: "2024-02-16T12:00:00.000Z",
        },
      };

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const exit = await runFetcherExit(fetcher, entry);
      expect(Exit.isFailure(exit)).toBe(true);
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

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          text: async () => malformedHtml,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);
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

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          text: async () => "",
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);
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

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          text: async () => htmlWithNoStatus,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);
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
        api_config: { type: "custom" },
      };

      const exit = await runFetcherExit(fetcher, entry);
      const err = expectFetchError(exit);
      if (!(err.cause instanceof Error)) {
        throw new Error("expected Error cause");
      }
      expect(err.cause.message).toContain(
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

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({}),
        } as Response),
      );

      const exit = await runFetcherExit(fetcher, entry);
      const err = expectFetchError(exit);
      if (!(err.cause instanceof Error)) {
        throw new Error("expected Error cause");
      }
      expect(err.cause.message).toContain(
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

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => minimalResponse,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);
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

    for (const { code, text } of testCases) {
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

        installMockFetch(() =>
          Promise.resolve({
            ok: false,
            status: code,
            statusText: text,
          } as Response),
        );

        const exit = await runFetcherExit(fetcher, entry);
        const err = expectFetchError(exit);
        expect(err.httpStatus).toBe(code);
      });
    }
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
          updated_at: "not-a-date",
        },
        status: {
          indicator: "none",
          description: "All Systems Operational",
        },
      };

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const exit = await runFetcherExit(fetcher, entry);
      expect(Exit.isFailure(exit)).toBe(true);
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

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);
      expect(result.severity).toBe("none");
      expect(result.status).toBe("operational");
      expect(typeof result.updated_at).toBe("number");
    });
  });
});
