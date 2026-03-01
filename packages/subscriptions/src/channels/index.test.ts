import { describe, expect, test } from "bun:test";
import { getChannel } from "./index";

describe("getChannel", () => {
  test('returns email channel for "email"', () => {
    const channel = getChannel("email");
    expect(channel).not.toBeNull();
    expect(channel?.id).toBe("email");
    expect(typeof channel?.sendNotifications).toBe("function");
    expect(typeof channel?.sendVerification).toBe("function");
    expect(typeof channel?.validateConfig).toBe("function");
  });

  test('returns webhook channel for "webhook"', () => {
    const channel = getChannel("webhook");
    expect(channel).not.toBeNull();
    expect(channel?.id).toBe("webhook");
    expect(typeof channel?.sendNotifications).toBe("function");
    expect(typeof channel?.sendVerification).toBe("function");
    expect(typeof channel?.validateConfig).toBe("function");
  });

  test("returns null for unknown channel types", () => {
    expect(getChannel("sms")).toBeNull();
    expect(getChannel("slack")).toBeNull();
    expect(getChannel("")).toBeNull();
  });
});
