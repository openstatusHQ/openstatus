import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { getValidSubdomain, stripHostPort } from "./domain";

describe("stripHostPort", () => {
  test("drops the port", () => {
    expect(stripHostPort("status.acme.com:8080")).toBe("status.acme.com");
    expect(stripHostPort("localhost:3000")).toBe("localhost");
  });

  test("leaves a portless host untouched", () => {
    expect(stripHostPort("status.acme.com")).toBe("status.acme.com");
  });

  test("does not normalise case — callers lowercase themselves", () => {
    expect(stripHostPort("Status.Acme.COM")).toBe("Status.Acme.COM");
  });

  test("passes null/undefined through", () => {
    expect(stripHostPort(null)).toBe(null);
    expect(stripHostPort(undefined)).toBe(null);
    expect(stripHostPort("")).toBe("");
  });

  test("a bare IPv6 literal is mangled: the trailing `:1` reads as a port", () => {
    // Hosts arrive bracketed (`[::1]:3000`) from real clients, so this only
    // shows up in hand-built values.
    expect(stripHostPort("::1")).toBe(":");
  });
});

describe("getValidSubdomain", () => {
  describe("openstatus.dev / stpg.dev hosts", () => {
    test("tenant subdomain → the slug", () => {
      expect(getValidSubdomain("acme.openstatus.dev")).toBe("acme");
      expect(getValidSubdomain("acme.stpg.dev")).toBe("acme");
    });

    test("`www.` is not a tenant", () => {
      expect(getValidSubdomain("www.openstatus.dev")).toBe(null);
      expect(getValidSubdomain("www.stpg.dev")).toBe(null);
    });

    test("the theme explorer host resolves like any other subdomain", () => {
      // No `page` row matches "themes", so the proxy passes through to `/`.
      expect(getValidSubdomain("themes.openstatus.dev")).toBe("themes");
    });

    test("apex openstatus.dev reads its own first label as the slug", () => {
      expect(getValidSubdomain("openstatus.dev")).toBe("openstatus");
    });
  });

  describe("localhost", () => {
    test("bare localhost is not a tenant (path routing in dev)", () => {
      expect(getValidSubdomain("localhost")).toBe(null);
      expect(getValidSubdomain("localhost:3000")).toBe(null);
    });

    test("subdomain of localhost → the slug, port stripped", () => {
      expect(getValidSubdomain("acme.localhost:3000")).toBe("acme");
      expect(getValidSubdomain("acme.localhost")).toBe("acme");
    });
  });

  describe("vercel deployments", () => {
    test("*.vercel.app is never a tenant", () => {
      expect(getValidSubdomain("status-page-abc123.vercel.app")).toBe(null);
      expect(getValidSubdomain("status-page-git-main-os.vercel.app")).toBe(
        null,
      );
    });
  });

  describe("custom domains", () => {
    test("the whole host is the lookup key, not its first label", () => {
      expect(getValidSubdomain("status.acme.com")).toBe("status.acme.com");
      expect(getValidSubdomain("acme.com")).toBe("acme.com");
      expect(getValidSubdomain("acme.co.uk")).toBe("acme.co.uk");
    });

    test("`www.` custom domains are kept whole", () => {
      expect(getValidSubdomain("www.acme.com")).toBe("www.acme.com");
    });

    test("no host at all → no tenant", () => {
      expect(getValidSubdomain(null)).toBe(null);
      expect(getValidSubdomain(undefined)).toBe(null);
      expect(getValidSubdomain("")).toBe(null);
    });
  });

  describe("known gaps — pinned so a fix is a deliberate change", () => {
    test("a look-alike host matches by substring and yields the tenant slug", () => {
      // `host.includes("openstatus.dev")` is a substring test, so an attacker
      // domain ending in `.evil.com` still resolves to tenant `acme`. Reaching
      // this needs the domain attached to the deployment, which Vercel refuses
      // without domain verification — hence pinned, not treated as live.
      expect(getValidSubdomain("acme.openstatus.dev.evil.com")).toBe("acme");
    });

    test("an uppercase Host is read as a custom domain", () => {
      // The `.includes()` guards are case-sensitive, so the whole host becomes
      // the lookup key and no `page` row matches → a valid page 404s. Browsers
      // send lowercase hosts, so this needs a hand-built request.
      expect(getValidSubdomain("ACME.OPENSTATUS.DEV")).toBe(
        "ACME.OPENSTATUS.DEV",
      );
    });

    test("a custom domain keeps its port, which never matches page.customDomain", () => {
      // `page.customDomain` is stored without a port and `stripHostPort` is
      // never applied on this path. Only reachable in local dev.
      expect(getValidSubdomain("status.acme.com:8080")).toBe(
        "status.acme.com:8080",
      );
    });

    test("IP hosts are not excluded — the exclusion regex is double-escaped", () => {
      // `/^(localhost|127\\.0\\.0\\.1|...)/` matches literal backslashes, so
      // every alternative but `localhost` is inert and an IP host is treated as
      // a custom domain.
      expect(getValidSubdomain("127.0.0.1:3000")).toBe("127.0.0.1:3000");
      expect(getValidSubdomain("192.168.1.10")).toBe("192.168.1.10");
    });
  });
});
