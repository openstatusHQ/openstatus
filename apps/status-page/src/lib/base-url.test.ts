import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";

import { getBaseUrl } from "./base-url";

let originalEnv: string | undefined;

beforeEach(() => {
  originalEnv = process.env.NODE_ENV;
});

afterEach(() => {
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

  it("serves from localhost in development, ignoring the custom domain", () => {
    setNodeEnv("development");
    expect(getBaseUrl({ slug: "acme", customDomain: "status.acme.com" })).toBe(
      "http://localhost:3000/acme",
    );
  });
});
