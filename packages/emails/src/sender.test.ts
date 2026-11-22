import "./test-preload.ts";
import { describe, expect, test } from "vitest";

import { senderFrom, senderReplyTo, statusPageFrom } from "./sender";

const OVERRIDE = "Status <noreply@status.example.com>";

describe("senderFrom", () => {
  test("keeps the default when EMAIL_FROM is unset", () => {
    expect(senderFrom("openstatus <a@openstatus.dev>", "")).toBe(
      "openstatus <a@openstatus.dev>",
    );
  });

  test("uses EMAIL_FROM when set", () => {
    expect(senderFrom("openstatus <a@openstatus.dev>", ` ${OVERRIDE} `)).toBe(
      OVERRIDE,
    );
  });
});

describe("senderReplyTo", () => {
  test("keeps the default when EMAIL_FROM is unset", () => {
    expect(senderReplyTo("ping@openstatus.dev", "")).toBe(
      "ping@openstatus.dev",
    );
  });

  test("is dropped when EMAIL_FROM is set", () => {
    expect(senderReplyTo("ping@openstatus.dev", OVERRIDE)).toBeUndefined();
  });
});

describe("statusPageFrom", () => {
  test("quotes the page title", () => {
    expect(statusPageFrom("Acme")).toBe(
      '"Acme" <notifications@subscribers.openstatus.dev>',
    );
  });

  test("keeps commas inside the quoted name", () => {
    expect(statusPageFrom("Acme, Inc.")).toBe(
      '"Acme, Inc." <notifications@subscribers.openstatus.dev>',
    );
  });

  test("strips characters that would break the header", () => {
    expect(statusPageFrom('Acme "EU" <status>\r\nBcc: x\\y')).toBe(
      '"Acme EU status Bcc: x y" <notifications@subscribers.openstatus.dev>',
    );
  });

  test("strips @ so the name can't pose as an address", () => {
    expect(statusPageFrom("security@paypal.com")).toBe(
      '"security paypal.com" <notifications@subscribers.openstatus.dev>',
    );
  });

  test("caps the length without splitting characters", () => {
    const from = statusPageFrom(`${"a".repeat(59)}🚀🚀`);
    expect(from).toBe(
      `"${"a".repeat(59)}🚀" <notifications@subscribers.openstatus.dev>`,
    );
  });

  test("falls back to openstatus when nothing is left", () => {
    expect(statusPageFrom(' "<>" ')).toBe(
      '"openstatus" <notifications@subscribers.openstatus.dev>',
    );
    expect(statusPageFrom(null)).toBe(
      '"openstatus" <notifications@subscribers.openstatus.dev>',
    );
  });

  test("sends from the EMAIL_FROM address under the page title", () => {
    expect(statusPageFrom("Acme", OVERRIDE)).toBe(
      '"Acme" <noreply@status.example.com>',
    );
  });

  test("accepts a bare EMAIL_FROM address", () => {
    expect(statusPageFrom("Acme", "noreply@status.example.com")).toBe(
      '"Acme" <noreply@status.example.com>',
    );
  });
});
