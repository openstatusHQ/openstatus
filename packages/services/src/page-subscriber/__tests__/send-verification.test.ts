import { beforeEach, describe, expect, test, vi } from "vitest";

import { InternalServiceError } from "../../errors";
import { sendSubscriberVerification } from "../send-verification";

const { sendVerification, getChannel } = vi.hoisted(() => {
  const sendVerification = vi.fn(async () => {});
  return {
    sendVerification,
    getChannel: vi.fn((_: string) => ({ sendVerification }) as unknown),
  };
});

vi.mock("@openstatus/subscriptions", () => ({ getChannel }));

const pending = {
  id: 7,
  pageId: 3,
  pageName: "Acme",
  pageSlug: "acme",
  customDomain: null,
  email: "jane@acme.com",
  token: "tok-123",
  acceptedAt: null,
};

beforeEach(() => {
  sendVerification.mockClear();
  getChannel.mockClear();
});

describe("sendSubscriberVerification", () => {
  test("emails the link on the openstatus subdomain", async () => {
    await sendSubscriberVerification({ subscriber: pending });
    expect(getChannel).toHaveBeenCalledWith("email");
    expect(sendVerification).toHaveBeenCalledWith(
      {
        id: 7,
        pageId: 3,
        pageName: "Acme",
        pageSlug: "acme",
        customDomain: null,
        componentIds: [],
        channelType: "email",
        email: "jane@acme.com",
        token: "tok-123",
      },
      "https://acme.openstatus.dev/verify/tok-123",
    );
  });

  test("uses the custom domain when the page has one", async () => {
    await sendSubscriberVerification({
      subscriber: { ...pending, customDomain: "status.acme.com" },
    });
    expect(sendVerification.mock.calls[0]?.[1]).toBe(
      "https://status.acme.com/verify/tok-123",
    );
  });

  test("an empty custom domain falls back to the subdomain", async () => {
    await sendSubscriberVerification({
      subscriber: { ...pending, customDomain: "" },
    });
    expect(sendVerification.mock.calls[0]?.[1]).toBe(
      "https://acme.openstatus.dev/verify/tok-123",
    );
  });

  test.each([
    ["a verified subscriber", { acceptedAt: new Date() }],
    ["a subscriber without a token", { token: null }],
    ["a subscriber without an email", { email: "" }],
  ])("sends nothing for %s", async (_label, patch) => {
    await sendSubscriberVerification({ subscriber: { ...pending, ...patch } });
    expect(sendVerification).not.toHaveBeenCalled();
  });

  test("throws an internal error when the email channel is missing", async () => {
    getChannel.mockReturnValueOnce(undefined);
    await expect(
      sendSubscriberVerification({ subscriber: pending }),
    ).rejects.toBeInstanceOf(InternalServiceError);
  });

  test("throws an internal error when the channel cannot send verifications", async () => {
    getChannel.mockReturnValueOnce({});
    await expect(
      sendSubscriberVerification({ subscriber: pending }),
    ).rejects.toBeInstanceOf(InternalServiceError);
  });

  test("propagates a send failure to the caller", async () => {
    sendVerification.mockRejectedValueOnce(new Error("resend down"));
    await expect(
      sendSubscriberVerification({ subscriber: pending }),
    ).rejects.toThrow("resend down");
  });
});
