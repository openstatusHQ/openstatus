import { beforeEach, describe, expect, it, mock } from "bun:test";
import { HtmlScraperFetcher } from "../../src/fetchers/html";
import type { StatusPageEntry } from "../../src/types";

describe("HtmlScraperFetcher", () => {
  let fetcher: HtmlScraperFetcher;

  beforeEach(() => {
    fetcher = new HtmlScraperFetcher();
  });

  describe("canHandle", () => {
    it("should only handle entries with api_config.type = html-scraper", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "html-scraper" },
      };

      expect(fetcher.canHandle(entry)).toBe(true);
    });

    it("should not handle entries without html-scraper api_config", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
      };

      expect(fetcher.canHandle(entry)).toBe(false);
    });

    it("should not handle other api_config types", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "atlassian" },
      };

      expect(fetcher.canHandle(entry)).toBe(false);
    });
  });

  describe("fetch", () => {
    it("should scrape status from class attribute", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "html-scraper" },
      };

      const mockHtml = `
        <html>
          <body>
            <div class="status-operational">All Systems Operational</div>
          </body>
        </html>
      `;

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: async () => mockHtml,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

      expect(result.severity).toBe("none");
      expect(result.description).toBe("All Systems Operational");
      expect(result.timezone).toBe("UTC");
      expect(typeof result.updated_at).toBe("number");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://status.test.com",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "Mozilla/5.0 (compatible; OpenStatus-Bot/1.0)",
          }),
        }),
      );
    });

    it("should scrape status from data-status attribute", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "html-scraper" },
      };

      const mockHtml = `
        <html>
          <body>
            <div data-status="operational">Services running</div>
          </body>
        </html>
      `;

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: async () => mockHtml,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

      expect(result.severity).toBe("none");
      expect(result.description).toBe("operational");
    });

    it("should scrape status from meta tag", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "html-scraper" },
      };

      const mockHtml = `
        <html>
          <head>
            <meta name="status" content="All systems operational" />
          </head>
          <body></body>
        </html>
      `;

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: async () => mockHtml,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

      expect(result.severity).toBe("none");
      expect(result.description).toBe("All systems operational");
    });

    it("should infer minor status from 'degraded' keyword", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "html-scraper" },
      };

      const mockHtml = `
        <html>
          <body>
            <div class="status-indicator">Service Degraded</div>
          </body>
        </html>
      `;

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: async () => mockHtml,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

      expect(result.severity).toBe("minor");
      expect(result.description).toBe("Service Degraded");
    });

    it("should infer minor status from 'partial' keyword", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "html-scraper" },
      };

      const mockHtml = `
        <html>
          <body>
            <div class="status-message">Partial Service Outage</div>
          </body>
        </html>
      `;

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: async () => mockHtml,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

      expect(result.severity).toBe("minor");
      expect(result.description).toBe("Partial Service Outage");
    });

    it("should infer major status from 'outage' keyword", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "html-scraper" },
      };

      const mockHtml = `
        <html>
          <body>
            <div class="status-box">Major Outage in Progress</div>
          </body>
        </html>
      `;

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: async () => mockHtml,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

      expect(result.severity).toBe("major");
      expect(result.description).toBe("Major Outage in Progress");
    });

    it("should infer major status from 'down' keyword", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "html-scraper" },
      };

      const mockHtml = `
        <html>
          <body>
            <div class="status-text">System Down</div>
          </body>
        </html>
      `;

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: async () => mockHtml,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

      expect(result.severity).toBe("major");
      expect(result.description).toBe("System Down");
    });

    it("should return Unknown if no status pattern found", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "html-scraper" },
      };

      const mockHtml = `
        <html>
          <body>
            <div>No status information</div>
          </body>
        </html>
      `;

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: async () => mockHtml,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

      expect(result.severity).toBe("none");
      expect(result.description).toBe("Unknown");
    });

    it("should throw error on non-200 response", async () => {
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
          ok: false,
          status: 404,
        } as Response),
      );

      await expect(fetcher.fetch(entry)).rejects.toThrow("HTTP 404:");
    });

    it("should trim whitespace from description", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "html-scraper" },
      };

      const mockHtml = `
        <html>
          <body>
            <div class="status">

              All Systems Operational

            </div>
          </body>
        </html>
      `;

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: async () => mockHtml,
        } as Response),
      );

      const result = await fetcher.fetch(entry);

      expect(result.description).toBe("All Systems Operational");
    });
  });
});
