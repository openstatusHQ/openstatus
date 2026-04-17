import { describe, expect, test } from "bun:test";
import type { ResolvedRoute } from "../resolve-route";
import { resolveIpRestrictionAction } from "./resolve-ip-restriction-action";

const pathnameRoute: ResolvedRoute = {
  type: "pathname",
  prefix: "acme",
  locale: "en",
  localeExplicit: true,
  rewritePath: "/acme/en",
};

const hostnameRoute: ResolvedRoute = {
  type: "hostname",
  prefix: "acme",
  locale: "en",
  localeExplicit: true,
  rewritePath: "/acme/en",
};

const page = {
  accessType: "ip-restriction" as const,
  allowedIpRanges: ["10.0.0.0/24"],
};

describe("resolveIpRestrictionAction", () => {
  test("non-ip-restriction page: passes (null)", () => {
    expect(
      resolveIpRestrictionAction({
        route: pathnameRoute,
        page: { ...page, accessType: "public" as const },
        pathname: "/acme/en",
        clientIp: "1.1.1.1",
        origin: "http://localhost:3000",
      }),
    ).toBeNull();
  });

  test("gate-in pathname: disallowed IP → redirect to /acme/restricted", () => {
    const action = resolveIpRestrictionAction({
      route: pathnameRoute,
      page,
      pathname: "/acme/en",
      clientIp: "1.2.3.4",
      origin: "http://localhost:3000",
    });
    expect(action?.reason).toBe("ip-restriction-gate-in");
    expect(action?.url?.pathname).toBe("/acme/restricted");
  });

  test("gate-in hostname: disallowed IP → redirect to /restricted (no prefix)", () => {
    const action = resolveIpRestrictionAction({
      route: hostnameRoute,
      page,
      pathname: "/en",
      clientIp: "1.2.3.4",
      origin: "http://acme.localhost:3000",
    });
    expect(action?.url?.pathname).toBe("/restricted");
  });

  test("gate-in: missing clientIp treated as disallowed", () => {
    const action = resolveIpRestrictionAction({
      route: pathnameRoute,
      page,
      pathname: "/acme/en",
      clientIp: null,
      origin: "http://localhost:3000",
    });
    expect(action?.reason).toBe("ip-restriction-gate-in");
  });

  test("gate-out pathname: allowed IP on /restricted → /acme", () => {
    const action = resolveIpRestrictionAction({
      route: pathnameRoute,
      page,
      pathname: "/acme/restricted",
      clientIp: "10.0.0.5",
      origin: "http://localhost:3000",
    });
    expect(action?.reason).toBe("ip-restriction-gate-out");
    expect(action?.url?.pathname).toBe("/acme");
  });

  test("gate-out hostname: allowed IP on /restricted → /", () => {
    const action = resolveIpRestrictionAction({
      route: hostnameRoute,
      page,
      pathname: "/restricted",
      clientIp: "10.0.0.5",
      origin: "http://acme.localhost:3000",
    });
    expect(action?.url?.pathname).toBe("/");
  });

  test("allowed IP off /restricted: passes (null)", () => {
    expect(
      resolveIpRestrictionAction({
        route: pathnameRoute,
        page,
        pathname: "/acme/en",
        clientIp: "10.0.0.5",
        origin: "http://localhost:3000",
      }),
    ).toBeNull();
  });

  test("disallowed IP on /restricted: passes (null — user already on gate)", () => {
    expect(
      resolveIpRestrictionAction({
        route: pathnameRoute,
        page,
        pathname: "/acme/restricted",
        clientIp: "1.2.3.4",
        origin: "http://localhost:3000",
      }),
    ).toBeNull();
  });
});
