import { describe, expect, test } from "bun:test";
import { isIpAllowed } from "./is-ip-allowed";

describe("isIpAllowed", () => {
  test("empty allowed ranges → denies all", () => {
    expect(isIpAllowed("1.2.3.4", [])).toBe(false);
  });

  test("IP inside single range → allowed", () => {
    expect(isIpAllowed("10.0.0.5", ["10.0.0.0/24"])).toBe(true);
  });

  test("IP outside single range → denied", () => {
    expect(isIpAllowed("10.0.1.5", ["10.0.0.0/24"])).toBe(false);
  });

  test("IP matches one of multiple ranges → allowed", () => {
    expect(isIpAllowed("192.168.1.10", ["10.0.0.0/24", "192.168.1.0/24"])).toBe(
      true,
    );
  });

  test("IP matches none of multiple ranges → denied", () => {
    expect(isIpAllowed("172.16.0.1", ["10.0.0.0/24", "192.168.1.0/24"])).toBe(
      false,
    );
  });

  test("exact /32 single-host range", () => {
    expect(isIpAllowed("1.2.3.4", ["1.2.3.4/32"])).toBe(true);
    expect(isIpAllowed("1.2.3.5", ["1.2.3.4/32"])).toBe(false);
  });

  test("malformed range is skipped, other ranges still evaluated", () => {
    expect(isIpAllowed("10.0.0.1", ["not-a-cidr", "10.0.0.0/24"])).toBe(true);
  });

  test("all malformed ranges → denied", () => {
    expect(isIpAllowed("10.0.0.1", ["not-a-cidr", "also-bad"])).toBe(false);
  });

  test("IPv6 range match", () => {
    expect(isIpAllowed("2001:db8::1", ["2001:db8::/32"])).toBe(true);
  });
});
