import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BetterStackFetcher } from "../../src/fetchers/betterstack";
import type { StatusPageEntry } from "../../src/types";
import {
  expectComponentsFetchError,
  expectFetchError,
  expectIncidentsFetchError,
  installMockFetch,
  runComponents,
  runComponentsExit,
  runFetcher,
  runFetcherExit,
  runIncidents,
  runIncidentsExit,
} from "../helpers";

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

      const fetchMock = installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);

      expect(result.severity).toBe("none");
      expect(result.description).toBe("All Systems Operational");
      expect(result.timezone).toBe("America/New_York");
      expect(typeof result.updated_at).toBe("number");
      const call = fetchMock.mock.lastCall;
      expect(call?.[0]).toBe("https://status.test.com/index.json");
      expect(call?.[1]).toEqual(
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

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);

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

      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const result = await runFetcher(fetcher, entry);

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

      const fetchMock = installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      await runFetcher(fetcher, entry);

      const call = fetchMock.mock.lastCall;
      expect(call?.[0]).toBe("https://custom.endpoint.com/status.json");
      expect(call?.[1]).toEqual(expect.any(Object));
    });

    it("should fail with FetchError on 4xx response", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "better-uptime",
        industry: ["saas"],
      };

      installMockFetch(() =>
        Promise.resolve({
          ok: false,
          status: 403,
          statusText: "Forbidden",
        } as Response),
      );

      const exit = await runFetcherExit(fetcher, entry);
      const err = expectFetchError(exit);
      expect(err.httpStatus).toBe(403);
    });

    it("should fail with FetchError on invalid JSON schema", async () => {
      const entry: StatusPageEntry = {
        id: "test",
        name: "Test",
        url: "https://test.com",
        status_page_url: "https://status.test.com",
        provider: "better-uptime",
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

  describe("included records", () => {
    const entry: StatusPageEntry = {
      id: "test",
      name: "Test",
      url: "https://test.com",
      status_page_url: "https://status.test.com",
      provider: "better-uptime",
      industry: ["saas"],
    };

    // `normalizeIncidents` compares maintenance windows against the clock.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-10T00:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const mockIncluded = (included: unknown[]) =>
      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ data: {}, included }),
        } as Response),
      );

    const section = (id: string, name: string, position: number) => ({
      id,
      type: "status_page_section",
      attributes: { name, position },
    });

    const resource = (
      id: string,
      attributes: {
        section: number | null;
        name: string;
        position: number;
        status: string | null;
        explanation?: string;
      },
    ) => ({
      id,
      type: "status_page_resource",
      attributes: {
        status_page_section_id: attributes.section,
        public_name: attributes.name,
        explanation: attributes.explanation ?? "",
        position: attributes.position,
        status: attributes.status,
        status_history: [{ day: "2026-11-06", status: "operational" }],
      },
    });

    const report = (
      id: string,
      attributes: {
        type?: string;
        startsAt?: string | null;
        endsAt?: string | null;
        state?: string | null;
        affected?: { id: string; status: string }[];
        updates?: string[];
      } = {},
    ) => ({
      id,
      type: "status_report",
      attributes: {
        title: `Report ${id}`,
        report_type: attributes.type ?? "manual",
        starts_at:
          attributes.startsAt === undefined
            ? "2026-11-02T13:48:00.000Z"
            : attributes.startsAt,
        ends_at: attributes.endsAt ?? null,
        affected_resources: (attributes.affected ?? []).map((a) => ({
          status_page_resource_id: a.id,
          status: a.status,
        })),
        aggregate_state:
          attributes.state === undefined ? "resolved" : attributes.state,
      },
      relationships: {
        status_updates: {
          data: (attributes.updates ?? []).map((u) => ({
            id: u,
            type: "status_update",
          })),
        },
      },
    });

    const update = (
      id: string,
      publishedAt: string,
      affected: { id: string; status: string }[] = [],
    ) => ({
      id,
      type: "status_update",
      attributes: {
        message: "msg",
        published_at: publishedAt,
        affected_resources: affected.map((a) => ({
          status_page_resource_id: a.id,
          status: a.status,
        })),
      },
    });

    describe("fetchComponents", () => {
      it("flattens per-section positions and trims section names", async () => {
        mockIncluded([
          section("2", "Second", 1),
          section("1", "First ", 0),
          resource("c", {
            section: 2,
            name: "C",
            position: 0,
            status: "operational",
          }),
          resource("b", {
            section: 1,
            name: "B",
            position: 1,
            status: "operational",
          }),
          resource("a", {
            section: 1,
            name: "A",
            position: 0,
            status: "operational",
            explanation: "About A",
          }),
        ]);

        const components = await runComponents(fetcher, entry);

        expect(components).toEqual([
          {
            upstreamComponentId: "a",
            name: "A",
            description: "About A",
            groupName: "First",
            position: 0,
            severity: "none",
            status: "operational",
          },
          {
            upstreamComponentId: "b",
            name: "B",
            description: undefined,
            groupName: "First",
            position: 1,
            severity: "none",
            status: "operational",
          },
          {
            upstreamComponentId: "c",
            name: "C",
            description: undefined,
            groupName: "Second",
            position: 2,
            severity: "none",
            status: "operational",
          },
        ]);
      });

      it("maps resource statuses like the page aggregate", async () => {
        mockIncluded([
          resource("d", {
            section: null,
            name: "D",
            position: 0,
            status: "degraded",
          }),
          resource("o", {
            section: null,
            name: "O",
            position: 1,
            status: "downtime",
          }),
          resource("m", {
            section: null,
            name: "M",
            position: 2,
            status: "maintenance",
          }),
        ]);

        const components = await runComponents(fetcher, entry);

        expect(
          components.map((c) => [c.upstreamComponentId, c.severity, c.status]),
        ).toEqual([
          ["d", "minor", "degraded"],
          ["o", "major", "major_outage"],
          ["m", "none", "under_maintenance"],
        ]);
        expect(components[0]?.groupName).toBeUndefined();
      });

      it("skips resources with no status to report", async () => {
        mockIncluded([
          resource("n", {
            section: null,
            name: "N",
            position: 0,
            status: "not_monitored",
          }),
          resource("x", {
            section: null,
            name: "X",
            position: 1,
            status: null,
          }),
          resource("e", {
            section: null,
            name: " ",
            position: 2,
            status: "operational",
          }),
          resource("k", {
            section: null,
            name: "K",
            position: 3,
            status: "operational",
          }),
        ]);

        const components = await runComponents(fetcher, entry);

        expect(components.map((c) => c.upstreamComponentId)).toEqual(["k"]);
        expect(components[0]?.position).toBe(0);
      });

      it("ignores unknown included types and tolerates no included", async () => {
        mockIncluded([{ id: "1", type: "something_new", attributes: {} }]);
        expect(await runComponents(fetcher, entry)).toEqual([]);

        installMockFetch(() =>
          Promise.resolve({
            ok: true,
            json: async () => ({ data: {} }),
          } as Response),
        );
        expect(await runComponents(fetcher, entry)).toEqual([]);
      });

      it("tolerates resources missing optional attributes", async () => {
        mockIncluded([
          { id: "s", type: "status_page_section", attributes: {} },
          {
            id: "k",
            type: "status_page_resource",
            attributes: { public_name: "K", status: "operational" },
          },
        ]);

        const components = await runComponents(fetcher, entry);

        expect(components).toEqual([
          {
            upstreamComponentId: "k",
            name: "K",
            description: undefined,
            groupName: undefined,
            position: 0,
            severity: "none",
            status: "operational",
          },
        ]);
      });

      it("fails with FetchError on a malformed known record", async () => {
        mockIncluded([
          { id: "1", type: "status_page_resource", attributes: {} },
        ]);

        const err = expectComponentsFetchError(
          await runComponentsExit(fetcher, entry),
        );
        expect(err.fetcherName).toBe("betterstack");
      });

      it("uses api_config.endpoint when set", async () => {
        const fetchMock = mockIncluded([]);

        await runComponents(fetcher, {
          ...entry,
          api_config: {
            type: "betterstack",
            endpoint: "https://custom.test.com/index.json",
          },
        });

        expect(fetchMock.mock.calls[0]?.[0]).toBe(
          "https://custom.test.com/index.json",
        );
      });
    });

    describe("fetchIncidents", () => {
      it("derives a resolved report from its updates when ends_at is null", async () => {
        const opened = update("u1", "2026-11-02T13:48:00.000Z", [
          { id: "r1", status: "degraded" },
        ]);
        const closed = update("u2", "2026-11-02T13:56:00.000Z", [
          { id: "r1", status: "resolved" },
        ]);
        const rawReport = report("10", {
          affected: [{ id: "r1", status: "resolved" }],
          updates: ["u2", "u1"],
        });
        mockIncluded([rawReport, closed, opened]);

        const [incident, ...rest] = await runIncidents(fetcher, entry);

        expect(rest).toEqual([]);
        expect(incident).toEqual({
          providerIncidentId: "10",
          name: "Report 10",
          status: "resolved",
          impact: "minor",
          shortlink: "https://status.test.com/incident/10",
          startedAt: new Date("2026-11-02T13:48:00.000Z"),
          createdAt: new Date("2026-11-02T13:48:00.000Z"),
          resolvedAt: new Date("2026-11-02T13:56:00.000Z"),
          affectedComponentIds: ["r1"],
          raw: { report: rawReport, updates: [opened, closed] },
        });
      });

      it("keeps an unresolved report ongoing and rates downtime as major", async () => {
        mockIncluded([
          report("10", {
            state: "Downtime",
            affected: [
              { id: "r1", status: "degraded" },
              { id: "r2", status: "downtime" },
            ],
          }),
        ]);

        const [incident] = await runIncidents(fetcher, entry);

        expect(incident?.status).toBe("downtime");
        expect(incident?.impact).toBe("major");
        expect(incident?.resolvedAt).toBeNull();
        expect(incident?.affectedComponentIds).toEqual(["r1", "r2"]);
      });

      it("treats an operational report as resolved", async () => {
        mockIncluded([
          report("10", { state: "operational", updates: ["u1"] }),
          update("u1", "2026-11-02T14:00:00.000Z"),
        ]);

        const [incident] = await runIncidents(fetcher, entry);

        expect(incident?.status).toBe("resolved");
        expect(incident?.resolvedAt).toEqual(
          new Date("2026-11-02T14:00:00.000Z"),
        );
      });

      it("leaves impact unset when no update recorded a severity", async () => {
        mockIncluded([
          report("10", { affected: [{ id: "r1", status: "resolved" }] }),
        ]);

        const [incident] = await runIncidents(fetcher, entry);

        expect(incident?.impact).toBeUndefined();
        expect(incident?.resolvedAt).toEqual(
          new Date("2026-11-02T13:48:00.000Z"),
        );
      });

      it("marks past maintenance as maintenance, resolved at ends_at", async () => {
        mockIncluded([
          report("10", {
            type: "maintenance",
            startsAt: "2026-09-03T15:00:00.000Z",
            endsAt: "2026-09-03T17:00:00.000Z",
            state: "maintenance",
          }),
        ]);

        const [incident] = await runIncidents(fetcher, entry);

        expect(incident?.impact).toBe("maintenance");
        expect(incident?.resolvedAt).toEqual(
          new Date("2026-09-03T17:00:00.000Z"),
        );
      });

      it("skips maintenance scheduled in the future", async () => {
        mockIncluded([
          report("10", {
            type: "maintenance",
            startsAt: "2999-01-01T00:00:00.000Z",
            endsAt: "2999-01-01T02:00:00.000Z",
            state: "maintenance",
          }),
        ]);

        expect(await runIncidents(fetcher, entry)).toEqual([]);
      });

      it("ignores a future ends_at on a window closed early", async () => {
        mockIncluded([
          report("10", {
            type: "maintenance",
            endsAt: "2999-01-01T02:00:00.000Z",
            updates: ["u1"],
          }),
          update("u1", "2026-11-02T14:00:00.000Z"),
        ]);

        const [incident] = await runIncidents(fetcher, entry);

        expect(incident?.resolvedAt).toEqual(
          new Date("2026-11-02T14:00:00.000Z"),
        );
      });

      it("skips a report with no start time and no updates", async () => {
        mockIncluded([report("10", { startsAt: null })]);

        expect(await runIncidents(fetcher, entry)).toEqual([]);
      });

      it("fails with FetchError on non-200", async () => {
        installMockFetch(() =>
          Promise.resolve({
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
          } as Response),
        );

        const err = expectIncidentsFetchError(
          await runIncidentsExit(fetcher, entry),
        );
        expect(err.httpStatus).toBe(503);
      });
    });

    it("does not let a malformed included record break status polling", async () => {
      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              id: "123",
              type: "status_page",
              attributes: {
                company_name: "Test",
                timezone: "UTC",
                aggregate_state: "operational",
                updated_at: "2026-11-06T12:00:00.000Z",
              },
            },
            included: [{ id: "1", type: "status_report", attributes: {} }],
          }),
        } as Response),
      );

      expect((await runFetcher(fetcher, entry)).status).toBe("operational");
    });
  });
});
