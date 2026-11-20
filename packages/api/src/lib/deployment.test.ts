import { afterEach, describe, expect, test, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  SELF_HOST: undefined as unknown,
  STATUS_PAGE_BASE_DOMAIN: undefined as unknown,
}));

vi.mock("../env", () => ({ env: mockEnv }));

import { getStatusPageBaseDomain, isSelfHost } from "./deployment";

afterEach(() => {
  mockEnv.SELF_HOST = undefined;
  mockEnv.STATUS_PAGE_BASE_DOMAIN = undefined;
});

describe("isSelfHost", () => {
  test("unset → hosted", () => {
    expect(isSelfHost()).toBe(false);
  });

  test("accepts the validated boolean", () => {
    mockEnv.SELF_HOST = true;
    expect(isSelfHost()).toBe(true);
    mockEnv.SELF_HOST = false;
    expect(isSelfHost()).toBe(false);
  });

  test("accepts the raw string (validation is skipped under NODE_ENV=test)", () => {
    mockEnv.SELF_HOST = "true";
    expect(isSelfHost()).toBe(true);
    mockEnv.SELF_HOST = "false";
    expect(isSelfHost()).toBe(false);
    mockEnv.SELF_HOST = "nonsense";
    expect(isSelfHost()).toBe(false);
  });
});

describe("getStatusPageBaseDomain", () => {
  test("unset or empty → openstatus.dev", () => {
    expect(getStatusPageBaseDomain()).toBe("openstatus.dev");
    mockEnv.STATUS_PAGE_BASE_DOMAIN = "";
    expect(getStatusPageBaseDomain()).toBe("openstatus.dev");
  });

  test("configured value, normalized", () => {
    mockEnv.STATUS_PAGE_BASE_DOMAIN = "https://Status.Example.com/";
    expect(getStatusPageBaseDomain()).toBe("status.example.com");
  });
});
