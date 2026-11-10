import { describe, expect, it } from "vitest";

import { routeContext } from "./route-context";

describe("routeContext", () => {
  it.each([
    ["/monitors/3", { type: "monitor", id: 3 }],
    ["/monitors/3/logs", { type: "monitor", id: 3 }],
    ["/status-pages/4/edit", { type: "status-page", id: 4 }],
    [
      "/status-pages/4/status-reports/9",
      { type: "status-page", id: 4, reportId: 9 },
    ],
    ["/status-pages/4/maintenances/2", { type: "status-page", id: 4 }],
    ["/incidents/7", { type: "incident", id: 7 }],
  ])("reads %s", (pathname, expected) => {
    expect(routeContext(pathname)).toEqual(expected);
  });

  it.each([
    "/overview",
    "/monitors",
    "/monitors/create",
    "/monitors/_/logs",
    "/status-pages/create",
    "/incidents",
    "/settings/general",
    "/monitors-archive/3",
  ])("has no context on %s", (pathname) => {
    expect(routeContext(pathname)).toBeNull();
  });
});
