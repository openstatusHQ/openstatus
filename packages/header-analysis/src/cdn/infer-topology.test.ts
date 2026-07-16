import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { inferTopology } from "./infer-topology";

describe("inferTopology", () => {
  test("same IP from many regions -> anycast (measured)", () => {
    const rows = [
      { edgeIp: "104.16.0.1" },
      { edgeIp: "104.16.0.1" },
      { edgeIp: "104.16.0.1" },
    ];
    expect(inferTopology(rows, null)).toEqual({
      topology: "anycast",
      basis: "edge-ips",
    });
  });

  test("different IPs -> unicast (measured)", () => {
    const rows = [{ edgeIp: "1.2.3.4" }, { edgeIp: "5.6.7.8" }];
    expect(inferTopology(rows, null)).toEqual({
      topology: "unicast",
      basis: "edge-ips",
    });
  });

  test("single IP but too few vantage points -> falls through", () => {
    const rows = [{ edgeIp: "1.2.3.4" }, { edgeIp: null }];
    expect(inferTopology(rows, null).topology).toBe("unknown");
  });

  test("null-IP rows are not vantage points", () => {
    const rows = [
      { edgeIp: "1.2.3.4" },
      { edgeIp: null },
      { edgeIp: null },
      { edgeIp: null },
    ];
    expect(inferTopology(rows, null)).toEqual({
      topology: "unknown",
      basis: null,
    });
  });

  test("no IPs, known-anycast provider -> provider heuristic", () => {
    const rows = [{ edgeIp: null }, { edgeIp: null }];
    expect(inferTopology(rows, "cloudflare")).toEqual({
      topology: "anycast",
      basis: "provider",
    });
    expect(inferTopology(rows, "cloudfront")).toEqual({
      topology: "unicast",
      basis: "provider",
    });
  });

  test("no IPs, unknown provider -> unknown", () => {
    expect(inferTopology([{ edgeIp: null }], null)).toEqual({
      topology: "unknown",
      basis: null,
    });
  });

  test("measured IPs win over provider heuristic", () => {
    const rows = [{ edgeIp: "1.2.3.4" }, { edgeIp: "5.6.7.8" }];
    expect(inferTopology(rows, "cloudflare").topology).toBe("unicast");
  });
});
