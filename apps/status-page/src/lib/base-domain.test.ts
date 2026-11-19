import { afterEach, describe, expect, test, vi } from "vitest";

import {
  DEFAULT_STATUS_PAGE_BASE_DOMAIN,
  getStatusPageBaseDomain,
  isHostUnderBaseDomain,
  normalizeBaseDomain,
} from "./base-domain";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("normalizeBaseDomain", () => {
  test("empty or missing → openstatus.dev", () => {
    expect(normalizeBaseDomain(undefined)).toBe("openstatus.dev");
    expect(normalizeBaseDomain(null)).toBe("openstatus.dev");
    expect(normalizeBaseDomain("")).toBe("openstatus.dev");
    expect(normalizeBaseDomain("   ")).toBe("openstatus.dev");
    expect(DEFAULT_STATUS_PAGE_BASE_DOMAIN).toBe("openstatus.dev");
  });

  test("strips scheme, path, port, surrounding dots and case", () => {
    expect(normalizeBaseDomain("https://Status.Example.com/")).toBe(
      "status.example.com",
    );
    expect(normalizeBaseDomain(".status.example.com.")).toBe(
      "status.example.com",
    );
    expect(normalizeBaseDomain("status.example.com:8443")).toBe(
      "status.example.com",
    );
  });
});

describe("getStatusPageBaseDomain", () => {
  test("defaults to openstatus.dev when STATUS_PAGE_BASE_DOMAIN is unset", () => {
    vi.stubEnv("STATUS_PAGE_BASE_DOMAIN", "");
    expect(getStatusPageBaseDomain()).toBe("openstatus.dev");
  });

  test("reads STATUS_PAGE_BASE_DOMAIN at call time", () => {
    vi.stubEnv("STATUS_PAGE_BASE_DOMAIN", "status.example.com");
    expect(getStatusPageBaseDomain()).toBe("status.example.com");
  });
});

describe("isHostUnderBaseDomain", () => {
  test("subdomains and the apex match, port ignored", () => {
    expect(
      isHostUnderBaseDomain("acme.status.example.com", "status.example.com"),
    ).toBe(true);
    expect(
      isHostUnderBaseDomain(
        "acme.status.example.com:443",
        "status.example.com",
      ),
    ).toBe(true);
    expect(
      isHostUnderBaseDomain("status.example.com", "status.example.com"),
    ).toBe(true);
  });

  test("look-alikes and unrelated hosts do not match", () => {
    expect(
      isHostUnderBaseDomain("acmestatus.example.com", "status.example.com"),
    ).toBe(false);
    expect(
      isHostUnderBaseDomain(
        "acme.status.example.com.evil.com",
        "status.example.com",
      ),
    ).toBe(false);
    expect(isHostUnderBaseDomain("status.acme.com", "status.example.com")).toBe(
      false,
    );
    expect(isHostUnderBaseDomain(null, "status.example.com")).toBe(false);
  });
});
