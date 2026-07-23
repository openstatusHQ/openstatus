import { expect } from "@std/expect";
import { beforeEach, describe, it } from "@std/testing/bdd";

import { AtlassianFetcher } from "../../src/fetchers/atlassian";
import { IncidentioFetcher } from "../../src/fetchers/incidentio";
import type { StatusFetcher, StatusPageEntry } from "../../src/types";
import {
  expectComponentsFetchError,
  installMockFetch,
  runComponents,
  runComponentsExit,
} from "../helpers";

const atlassianEntry: StatusPageEntry = {
  id: "vercel",
  name: "Vercel",
  url: "https://vercel.com",
  status_page_url: "https://www.vercel-status.com",
  provider: "atlassian-statuspage",
  industry: ["development-tools"],
  api_config: { type: "atlassian" },
};

const incidentioEntry: StatusPageEntry = {
  id: "linear",
  name: "Linear",
  url: "https://linear.app",
  status_page_url: "https://status.linear.app",
  provider: "incidentio",
  industry: ["development-tools"],
  api_config: { type: "incidentio" },
};

const mockComponents = [
  {
    id: "grp",
    name: "Regions",
    status: "operational",
    group: true,
    group_id: null,
    position: 1,
  },
  {
    id: "fra1",
    name: "Frankfurt",
    description: "EU Central edge",
    status: "partial_outage",
    group: false,
    group_id: "grp",
    position: 3,
  },
  {
    id: "arn1",
    name: "Stockholm",
    status: "degraded_performance",
    group: false,
    group_id: "grp",
    position: 2,
  },
  {
    id: "api",
    name: "API",
    status: "under_maintenance",
    group: false,
    group_id: null,
    position: 5,
  },
];

function itNormalizes(
  label: string,
  fetcher: StatusFetcher,
  entry: StatusPageEntry,
) {
  it(`normalizes ${label} components and drops group containers`, async () => {
    const fetchMock = installMockFetch(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ components: mockComponents }),
      } as Response),
    );

    const components = await runComponents(fetcher, entry);

    const call = fetchMock.calls[fetchMock.calls.length - 1];
    expect(call.args[0]).toBe(
      `${entry.status_page_url}/api/v2/components.json`,
    );
    expect(call.args[1]).toEqual(expect.any(Object));

    // group container "grp" is excluded; only the three leaves remain
    expect(components).toHaveLength(3);

    const byId = new Map(components.map((c) => [c.upstreamComponentId, c]));

    expect(byId.get("fra1")).toMatchObject({
      name: "Frankfurt",
      description: "EU Central edge",
      groupName: "Regions",
      position: 3,
      severity: "major",
      status: "partial_outage",
    });
    expect(byId.get("arn1")).toMatchObject({
      groupName: "Regions",
      severity: "minor",
      status: "degraded",
    });
    expect(byId.get("api")).toMatchObject({
      name: "API",
      groupName: undefined,
      severity: "none",
      status: "under_maintenance",
    });
  });
}

describe("fetchComponents", () => {
  let atlassian: AtlassianFetcher;

  beforeEach(() => {
    atlassian = new AtlassianFetcher();
  });

  describe("AtlassianFetcher", () => {
    itNormalizes("atlassian", new AtlassianFetcher(), atlassianEntry);

    it("fails with FetchError on malformed payload", async () => {
      installMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ not: "an array" }),
        } as Response),
      );

      const exit = await runComponentsExit(atlassian, atlassianEntry);
      const err = expectComponentsFetchError(exit);
      expect(err.cause).toBeInstanceOf(Error);
    });

    it("fails with FetchError on non-200", async () => {
      installMockFetch(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
        } as Response),
      );

      const exit = await runComponentsExit(atlassian, atlassianEntry);
      const err = expectComponentsFetchError(exit);
      expect(err.httpStatus).toBe(503);
      expect(err.fetcherName).toBe("atlassian");
    });
  });

  describe("IncidentioFetcher", () => {
    itNormalizes("incidentio", new IncidentioFetcher(), incidentioEntry);
  });
});
