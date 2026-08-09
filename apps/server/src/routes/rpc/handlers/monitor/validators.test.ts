import { Periodicity, Region } from "@openstatus/proto/monitor/v1";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { MONITOR_DEFAULTS } from "./converters";
import {
  getCommonCreateInput,
  getCommonUpdateInput,
  toValidMethod,
  toValidPeriodicity,
  validateCommonMonitorFields,
} from "./validators";

describe("getCommonCreateInput", () => {
  test("applies the documented defaults when nothing is supplied", () => {
    const result = getCommonCreateInput({ name: "m" });

    expect(result.timeout).toBe(MONITOR_DEFAULTS.timeout);
    expect(result.retry).toBe(MONITOR_DEFAULTS.retry);
    expect(result.active).toBe(MONITOR_DEFAULTS.active);
    expect(result.public).toBe(MONITOR_DEFAULTS.public);
    expect(result.description).toBe(MONITOR_DEFAULTS.description);
    expect(result.degradedAfter).toBeUndefined();
  });

  test("always yields a concrete regions array, never undefined", () => {
    // Guard rail: `undefined` would hand `createMonitor` its plan-based
    // random-region fallback, which the API has never done.
    expect(getCommonCreateInput({ name: "m" }).regions).toEqual([]);
    expect(getCommonCreateInput({ name: "m", regions: [] }).regions).toEqual(
      [],
    );
  });

  test("converts supplied regions and periodicity", () => {
    const result = getCommonCreateInput({
      name: "m",
      regions: [Region.FLY_AMS, Region.FLY_IAD],
      periodicity: Periodicity.PERIODICITY_10M,
    });

    expect(result.regions).toEqual(["ams", "iad"]);
    expect(result.periodicity).toBe("10m");
  });

  test("passes explicit values through", () => {
    const result = getCommonCreateInput({
      name: "m",
      timeout: BigInt(20_000),
      degradedAt: BigInt(5_000),
      retry: BigInt(1),
      active: true,
      public: true,
      description: "desc",
    });

    expect(result.timeout).toBe(20_000);
    expect(result.degradedAfter).toBe(5_000);
    expect(result.retry).toBe(1);
    expect(result.active).toBe(true);
    expect(result.public).toBe(true);
    expect(result.description).toBe("desc");
  });
});

describe("getCommonUpdateInput", () => {
  test("omits every field when nothing is supplied", () => {
    expect(getCommonUpdateInput({})).toEqual({});
  });

  test("treats proto zero-values as 'not supplied'", () => {
    // These fields have no explicit presence in the proto, so the zero
    // value is indistinguishable from omission and must not be written.
    const result = getCommonUpdateInput({
      name: "",
      periodicity: Periodicity.PERIODICITY_UNSPECIFIED,
      timeout: BigInt(0),
      retry: BigInt(0),
      regions: [],
    });

    expect(result).toEqual({});
  });

  test("applies explicit false / empty for fields with proto presence", () => {
    // `active`, `public` and `description` are optional in the proto, so
    // an explicit false/"" is a real edit and must survive.
    const result = getCommonUpdateInput({
      active: false,
      public: false,
      description: "",
    });

    expect(result.active).toBe(false);
    expect(result.public).toBe(false);
    expect(result.description).toBe("");
  });

  test("converts supplied regions and periodicity", () => {
    const result = getCommonUpdateInput({
      regions: [Region.FLY_AMS],
      periodicity: Periodicity.PERIODICITY_1M,
    });

    expect(result.regions).toEqual(["ams"]);
    expect(result.periodicity).toBe("1m");
  });

  test("carries degradedAt through as degradedAfter", () => {
    expect(getCommonUpdateInput({ degradedAt: BigInt(7_500) })).toEqual({
      degradedAfter: 7_500,
    });
  });

  test("splits an otel config into endpoint and headers", () => {
    const result = getCommonUpdateInput({
      openTelemetry: {
        $typeName: "openstatus.monitor.v1.OpenTelemetryConfig",
        endpoint: "https://otel.example.com",
        headers: [],
      },
    });

    expect(result.otelEndpoint).toBe("https://otel.example.com");
    expect(result.otelHeaders).toBeUndefined();
  });
});

describe("toValidPeriodicity / toValidMethod", () => {
  test("accepts known values", () => {
    expect(toValidPeriodicity("10m")).toBe("10m");
    expect(toValidMethod("post")).toBe("POST");
  });

  test("falls back on unknown values", () => {
    expect(toValidPeriodicity("weekly")).toBe("1m");
    expect(toValidPeriodicity(undefined)).toBe("1m");
    expect(toValidMethod("FROB")).toBe("GET");
    expect(toValidMethod(undefined)).toBe("GET");
  });
});

describe("validateCommonMonitorFields", () => {
  test("accepts valid and absent regions", () => {
    expect(() => validateCommonMonitorFields({})).not.toThrow();
    expect(() => validateCommonMonitorFields({ regions: [] })).not.toThrow();
    expect(() =>
      validateCommonMonitorFields({ regions: [Region.FLY_AMS] }),
    ).not.toThrow();
  });

  test("drops an unspecified region instead of rejecting it", () => {
    // Documents current behaviour, which is weaker than it looks:
    // `regionsToStrings` filters unmapped enum values to "", so the
    // "Invalid regions" error below can never fire on the RPC path —
    // every proto Region that maps to a non-empty string is in
    // AVAILABLE_REGIONS. An unknown region is silently dropped and the
    // monitor is created with fewer regions than the caller asked for.
    expect(() =>
      validateCommonMonitorFields({ regions: [Region.UNSPECIFIED] }),
    ).not.toThrow();
    expect(
      getCommonCreateInput({
        name: "m",
        regions: [Region.UNSPECIFIED, Region.FLY_AMS],
      }).regions,
    ).toEqual(["ams"]);
  });
});
