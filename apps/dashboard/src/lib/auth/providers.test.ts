import "@/test-preload";
import { AuthError } from "@auth/core/errors";
import { redis } from "@openstatus/upstash";
import { expect } from "@std/expect";
import { afterEach, describe, test } from "@std/testing/bdd";
import { type Stub, stub } from "@std/testing/mock";

import { ResendProvider } from "./providers";

let evalStub: Stub | undefined;
let logStub: Stub | undefined;

afterEach(() => {
  evalStub?.restore();
  logStub?.restore();
});

function sendTo(identifier: string, ip = "1.2.3.4") {
  // `Resend()` keeps overrides under `options`; Auth.js merges them at init.
  const send = ResendProvider.options?.sendVerificationRequest;
  if (!send) throw new Error("sendVerificationRequest override missing");
  return send({
    identifier,
    url: "https://app.openstatus.dev/api/auth/callback/resend?token=t",
    token: "t",
    expires: new Date(Date.now() + 60_000),
    provider: ResendProvider,
    request: new Request("https://app.openstatus.dev/api/auth/signin/resend", {
      headers: { "x-forwarded-for": ip },
    }),
    theme: {},
  });
}

describe("ResendProvider.sendVerificationRequest", () => {
  test("refuses disposable domains before touching the rate limit", async () => {
    evalStub = stub(redis, "eval");

    await expect(sendTo("a@mailinator.com")).rejects.toThrow(AuthError);
    await expect(sendTo("a@mailinator.com")).rejects.toThrow(
      "disposable domain",
    );
    expect(evalStub.calls).toHaveLength(0);
  });

  test("refuses throttled addresses", async () => {
    evalStub = stub(redis, "eval", () => Promise.resolve([1, 4]));

    await expect(sendTo("gilfoyle@piedpiper.dev")).rejects.toThrow(
      "rate limited",
    );
  });

  test("sends when screening passes, keyed by client ip and address", async () => {
    evalStub = stub(redis, "eval", () => Promise.resolve([1, 1]));
    logStub = stub(console, "log");

    await sendTo("gilfoyle@piedpiper.dev", "9.9.9.9");

    expect(evalStub.calls[0]?.args[1]).toEqual([
      "ratelimit:magic-link:ip:9.9.9.9",
      "ratelimit:magic-link:email:gilfoyle@piedpiper.dev",
    ]);
    const printed = logStub.calls.map((c) => String(c.args[0])).join("\n");
    expect(printed).toContain(
      "https://app.openstatus.dev/api/auth/callback/resend?token=t",
    );
  });
});
