import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getBaseUrl } from "./base-url";

let originalEnv: string | undefined;

beforeEach(() => {
  originalEnv = process.env.NODE_ENV;
});

afterEach(() => {
  vi.unstubAllEnvs();
  Object.assign(process.env, { NODE_ENV: originalEnv });
  if (originalEnv === undefined)
    Reflect.deleteProperty(process.env, "NODE_ENV");
});

function setNodeEnv(value: string) {
  Object.assign(process.env, { NODE_ENV: value });
}

describe("getBaseUrl", () => {
  it("uses the openstatus subdomain by default", () => {
    setNodeEnv("production");
    expect(getBaseUrl({ slug: "acme" })).toBe("https://acme.openstatus.dev");
  });

  it("prefers the custom domain", () => {
    setNodeEnv("production");
    expect(getBaseUrl({ slug: "acme", customDomain: "status.acme.com" })).toBe(
      "https://status.acme.com",
    );
  });

  it("uses an explicit base domain", () => {
    setNodeEnv("production");
    expect(getBaseUrl({ slug: "acme", baseDomain: "status.example.com" })).toBe(
      "https://acme.status.example.com",
    );
  });

  it("reads STATUS_PAGE_BASE_DOMAIN when no base domain is passed", () => {
    setNodeEnv("production");
    vi.stubEnv("STATUS_PAGE_BASE_DOMAIN", "status.example.com");
    expect(getBaseUrl({ slug: "acme" })).toBe(
      "https://acme.status.example.com",
    );
  });

  it("custom domain wins over the base domain", () => {
    setNodeEnv("production");
    expect(
      getBaseUrl({
        slug: "acme",
        customDomain: "status.acme.com",
        baseDomain: "status.example.com",
      }),
    ).toBe("https://status.acme.com");
  });

  it("serves from localhost in development, ignoring the custom domain", () => {
    setNodeEnv("development");
    expect(getBaseUrl({ slug: "acme", customDomain: "status.acme.com" })).toBe(
      "http://localhost:3000/acme",
    );
  });
});
