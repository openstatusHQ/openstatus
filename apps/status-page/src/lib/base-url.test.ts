import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getBaseUrl } from "./base-url";

let originalEnv: string | undefined;
let originalStatusPageBaseUrl: string | undefined;

beforeEach(() => {
  originalEnv = process.env.NODE_ENV;
  originalStatusPageBaseUrl = process.env.STATUS_PAGE_BASE_URL;
  delete process.env.STATUS_PAGE_BASE_URL;
  delete process.env.OPENSTATUS_STATUS_PAGE_URL;
});

afterEach(() => {
  Object.assign(process.env, {
    NODE_ENV: originalEnv,
    STATUS_PAGE_BASE_URL: originalStatusPageBaseUrl,
  });
  if (originalEnv === undefined)
    Reflect.deleteProperty(process.env, "NODE_ENV");
  if (originalStatusPageBaseUrl === undefined)
    Reflect.deleteProperty(process.env, "STATUS_PAGE_BASE_URL");
  Reflect.deleteProperty(process.env, "OPENSTATUS_STATUS_PAGE_URL");
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

  it("serves from localhost in development, ignoring the custom domain", () => {
    setNodeEnv("development");
    expect(getBaseUrl({ slug: "acme", customDomain: "status.acme.com" })).toBe(
      "http://localhost:3000/acme",
    );
  });

  it("uses STATUS_PAGE_BASE_URL with explicit port and scheme", () => {
    setNodeEnv("production");
    process.env.STATUS_PAGE_BASE_URL = "https://status.example.net:8443";
    expect(getBaseUrl({ slug: "acme" })).toBe(
      "https://status.example.net:8443",
    );
  });

  it("preserves STATUS_PAGE_BASE_URL even when customDomain is set", () => {
    setNodeEnv("production");
    process.env.STATUS_PAGE_BASE_URL = "https://status.example.net:8443";
    expect(
      getBaseUrl({ slug: "acme", customDomain: "planned-dns.example.com" }),
    ).toBe("https://status.example.net:8443");
  });

  it("interpolates {slug} when STATUS_PAGE_BASE_URL is a slug template", () => {
    setNodeEnv("production");
    process.env.STATUS_PAGE_BASE_URL = "https://{slug}.status.example.net";
    expect(getBaseUrl({ slug: "acme" })).toBe(
      "https://acme.status.example.net",
    );
  });
});
