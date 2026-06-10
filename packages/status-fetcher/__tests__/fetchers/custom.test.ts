import { beforeEach, describe, expect, it } from "bun:test";

import { CustomApiFetcher } from "../../src/fetchers/custom";
import type { StatusPageEntry } from "../../src/types";
import {
  expectFetchError,
  installMockFetch,
  runFetcher,
  runFetcherExit,
} from "../helpers";

describe("CustomApiFetcher", () => {
  let fetcher: CustomApiFetcher;

  beforeEach(() => {
    fetcher = new CustomApiFetcher();
  });

  describe("canHandle", () => {
    it("should only handle entries with api_config.type = custom", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "custom",
        industry: ["saas"],
        api_config: { type: "custom", endpoint: "https://api.test.com/status" },
      };

      expect(fetcher.canHandle(entry)).toBe(true);
    });

    it("should not handle entries without custom api_config", () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "custom",
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
        provider: "custom",
        industry: ["saas"],
        api_config: { type: "atlassian" },
      };

      expect(fetcher.canHandle(entry)).toBe(false);
    });
  });

  describe("fetch", () => {
    it("should fail with FetchError if endpoint is not provided", async () => {
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

    describe("Slack parser", () => {
      it("should parse Slack API with no incidents (ok status)", async () => {
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
        expect(result.description).toBe("All Systems Operational");
        expect(result.timezone).toBe("UTC");
        expect(typeof result.updated_at).toBe("number");
      });

      it("should parse Slack API with numeric timestamps", async () => {
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
          date_created: 1708091234,
          date_updated: 1708091234,
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
        expect(result.updated_at).toBe(1708091234000);
      });

      it("should handle Slack incidents (non-outage)", async () => {
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
          status: "active",
          date_created: 1708091234,
          date_updated: 1708091234,
          active_incidents: [
            {
              id: 123,
              title: "Login Issues",
              type: "incident",
              status: "investigating",
              services: ["Login"],
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

        expect(result.severity).toBe("minor");
        expect(result.description).toBe("Login Issues");
      });

      it("should handle Slack outages", async () => {
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
          status: "active",
          date_created: 1708091234,
          date_updated: 1708091234,
          active_incidents: [
            {
              id: 123,
              title: "Service Unavailable",
              type: "outage",
              status: "investigating",
              services: ["Messaging", "Files"],
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

        expect(result.severity).toBe("major");
        expect(result.description).toBe("Service Unavailable");
      });
    });

    describe("Generic parser", () => {
      it("should parse generic status with 'operational' keyword", async () => {
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

        const mockResponse = {
          status: "operational",
          message: "All systems running smoothly",
        };

        installMockFetch(() =>
          Promise.resolve({
            ok: true,
            json: async () => mockResponse,
          } as Response),
        );

        const result = await runFetcher(fetcher, entry);

        expect(result.severity).toBe("none");
        expect(result.description).toBe("All systems running smoothly");
      });

      it("should infer major status from 'down' keyword", async () => {
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

        const mockResponse = {
          status: "down",
          message: "System is down",
        };

        installMockFetch(() =>
          Promise.resolve({
            ok: true,
            json: async () => mockResponse,
          } as Response),
        );

        const result = await runFetcher(fetcher, entry);

        expect(result.severity).toBe("major");
        expect(result.description).toBe("System is down");
      });

      it("should infer minor status from 'degraded' keyword", async () => {
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

        const mockResponse = {
          state: "degraded",
          description: "Performance issues",
        };

        installMockFetch(() =>
          Promise.resolve({
            ok: true,
            json: async () => mockResponse,
          } as Response),
        );

        const result = await runFetcher(fetcher, entry);

        expect(result.severity).toBe("minor");
        expect(result.description).toBe("Performance issues");
      });

      it("should handle health field", async () => {
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

        const mockResponse = {
          health: "healthy",
        };

        installMockFetch(() =>
          Promise.resolve({
            ok: true,
            json: async () => mockResponse,
          } as Response),
        );

        const result = await runFetcher(fetcher, entry);

        expect(result.severity).toBe("none");
        expect(result.description).toBe("healthy");
      });
    });

    describe("AWS parser", () => {
      it("should fail with FetchError for unimplemented AWS parser", async () => {
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
    });

    it("should fail with FetchError on 4xx response", async () => {
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

      installMockFetch(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
        } as Response),
      );

      const exit = await runFetcherExit(fetcher, entry);
      const err = expectFetchError(exit);
      expect(err.httpStatus).toBe(401);
    });
  });
});
