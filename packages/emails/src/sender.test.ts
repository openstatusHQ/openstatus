import { describe, expect, test } from "vitest";

import { statusPageFrom } from "./sender";

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
});
