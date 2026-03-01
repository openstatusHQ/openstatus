import { describe, expect, it, mock } from "bun:test";
import { fetchers as allFetchers } from "../src/fetchers";
import type { StatusPageEntry, StatusPageProvider } from "../src/types";

describe("Integration Tests", () => {
  describe("Fetcher Selection", () => {
    it("should select AtlassianFetcher for statuspage.io URLs", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.statuspage.io",
        provider: "unknown",
        industry: ["saas"],
      };

      // Use allFetchers imported above
      const selectedFetcher = allFetchers.find((f) => f.canHandle(entry));

      expect(selectedFetcher?.name).toBe("atlassian");
    });

    it("should select InstatusFetcher for instatus.com URLs", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://test.instatus.com",
        provider: "unknown",
        industry: ["saas"],
      };

      // Use allFetchers imported above
      const selectedFetcher = allFetchers.find((f) => f.canHandle(entry));

      expect(selectedFetcher?.name).toBe("instatus");
    });

    it("should select BetterStackFetcher for betteruptime.com URLs", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.betteruptime.com",
        provider: "unknown",
        industry: ["saas"],
      };

      // Use allFetchers imported above
      const selectedFetcher = allFetchers.find((f) => f.canHandle(entry));

      expect(selectedFetcher?.name).toBe("betterstack");
    });

    it("should select IncidentioFetcher for incident.io URLs", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.incident.io",
        provider: "unknown",
        industry: ["saas"],
      };

      // Use allFetchers imported above
      const selectedFetcher = allFetchers.find((f) => f.canHandle(entry));

      expect(selectedFetcher?.name).toBe("incidentio");
    });

    it("should select CustomApiFetcher for custom api_config", () => {
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

      // Use allFetchers imported above
      const selectedFetcher = allFetchers.find((f) => f.canHandle(entry));

      expect(selectedFetcher?.name).toBe("custom");
    });

    it("should select HtmlScraperFetcher for html-scraper config", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "html-scraper" },
      };

      // Use allFetchers imported above
      const selectedFetcher = allFetchers.find((f) => f.canHandle(entry));

      expect(selectedFetcher?.name).toBe("html-scraper");
    });

    it("should match fetcher based on api_config.type when URL is ambiguous", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://customstatus.com", // Generic URL
        provider: "unknown",
        industry: ["saas"],
        api_config: { type: "html-scraper" }, // Explicit HTML scraper config
      };

      // Use allFetchers imported above
      const selectedFetcher = allFetchers.find((f) => f.canHandle(entry));

      expect(selectedFetcher?.name).toBe("html-scraper");
    });

    it("should prioritize provider field over URL patterns", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://customdomain.com",
        provider: "instatus", // Explicitly set provider
        industry: ["saas"],
      };

      // Use allFetchers imported above
      const selectedFetcher = allFetchers.find((f) => f.canHandle(entry));

      expect(selectedFetcher?.name).toBe("instatus");
    });
  });

  describe("Multiple Fetchers Match", () => {
    it("should return first matching fetcher when multiple can handle", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://test.statuspage.io",
        provider: "atlassian-statuspage",
        industry: ["saas"],
        api_config: { type: "atlassian" },
      };

      // Use allFetchers imported above
      const matchingFetchers = allFetchers.filter((f) => f.canHandle(entry));

      // Atlassian fetcher should match via provider, api_config, and URL
      expect(matchingFetchers.length).toBeGreaterThanOrEqual(1);
      expect(matchingFetchers[0].name).toBe("atlassian");
    });
  });

  describe("No Fetcher Matches", () => {
    it("should return undefined when no fetcher can handle entry", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://unknown-provider.com/status",
        provider: "unknown",
        industry: ["saas"],
      };

      // Use allFetchers imported above
      const selectedFetcher = allFetchers.find((f) => f.canHandle(entry));

      // Should find no matching fetcher (html-scraper would match if it has no restrictions)
      // Actually, html-scraper only matches if api_config.type === "html-scraper"
      expect(selectedFetcher).toBeUndefined();
    });
  });

  describe("StatusResult Consistency", () => {
    it("should return consistent StatusResult structure across fetchers", async () => {
      const atlassianEntry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://test.statuspage.io",
        provider: "atlassian-statuspage",
        industry: ["saas"],
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            page: {
              id: "123",
              name: "Test",
              url: "https://test.statuspage.io",
              timezone: "UTC",
              updated_at: "2024-02-16T12:00:00.000Z",
            },
            status: {
              indicator: "none",
              description: "All Systems Operational",
            },
          }),
        } as Response),
      );

      // Use allFetchers imported above
      const atlassianFetcher = allFetchers.find((f) => f.name === "atlassian");
      const result = await atlassianFetcher?.fetch(atlassianEntry);

      // Verify all required fields exist
      expect(result).toHaveProperty("severity");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("description");
      expect(result).toHaveProperty("updated_at");

      if (!result) {
        throw new Error("Result is undefined");
      }

      // Verify types
      expect(typeof result.severity).toBe("string");
      expect(typeof result.status).toBe("string");
      expect(typeof result.description).toBe("string");
      expect(typeof result.updated_at).toBe("number");
    });
  });

  describe("Severity and Status Mapping", () => {
    it("should map all operational states to severity 'none'", async () => {
      const testCases = [
        {
          fetcher: "instatus",
          mockResponse: {
            activeIncidents: [],
            activeMaintenances: [],
            status: { text: "All Good", type: "UP" },
            page: {
              name: "Test",
              url: "https://test.instatus.com",
              updated: "2024-02-16T12:00:00.000Z",
            },
          },
        },
      ];

      for (const testCase of testCases) {
        global.fetch = mock(() =>
          Promise.resolve({
            ok: true,
            json: async () => testCase.mockResponse,
          } as Response),
        );

        // Use allFetchers imported above
        const fetcher = allFetchers.find((f) => f.name === testCase.fetcher);

        const entry: StatusPageEntry = {
          id: "test",
          name: "Test",
          url: "https://test.com",
          status_page_url: `https://test.${testCase.fetcher}.com`,
          provider: testCase.fetcher as StatusPageProvider,
          industry: ["saas"],
        };

        const result = await fetcher?.fetch(entry);

        if (!result) {
          throw new Error("Result is undefined");
        }

        expect(result.severity).toBe("none");
        expect(result.status).toBe("operational");
      }
    });

    it("should map degraded states to severity 'minor'", async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
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
          }),
        } as Response),
      );

      // Use allFetchers imported above
      const fetcher = allFetchers.find((f) => f.name === "betterstack");

      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://test.betteruptime.com",
        provider: "better-uptime",
        industry: ["saas"],
      };

      const result = await fetcher?.fetch(entry);

      if (!result) {
        throw new Error("Result is undefined");
      }

      expect(result.severity).toBe("minor");
      expect(result.status).toBe("degraded");
    });
  });

  describe("Custom Endpoint Override", () => {
    it("should use custom endpoint when provided in api_config", async () => {
      const customEndpoint = "https://custom-api.test.com/v2/status";

      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "atlassian-statuspage",
        industry: ["saas"],
        api_config: {
          type: "atlassian",
          endpoint: customEndpoint,
        },
      };

      let fetchedUrl = "";
      global.fetch = mock((url) => {
        fetchedUrl = url;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            page: {
              id: "123",
              name: "Test",
              url: "https://status.test.com",
              timezone: "UTC",
              updated_at: "2024-02-16T12:00:00.000Z",
            },
            status: {
              indicator: "none",
              description: "All Systems Operational",
            },
          }),
        } as Response);
      });

      // Use allFetchers imported above
      const fetcher = allFetchers.find((f) => f.name === "atlassian");
      await fetcher?.fetch(entry);

      expect(fetchedUrl).toBe(customEndpoint);
    });
  });
});
