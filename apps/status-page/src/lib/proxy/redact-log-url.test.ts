import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { redactLogPathname, redactLogUrl } from "./redact-log-url";

describe("redactLogPathname", () => {
  test("masks the token after a subscriber route", () => {
    expect(
      redactLogPathname("/acme/en/manage/9f1c2f7e-2a5e-4d1b-9c9e-1c2b3a4d5e6f"),
    ).toBe("/acme/en/manage/[redacted]");
    expect(redactLogPathname("/acme/en/unsubscribe/abc123")).toBe(
      "/acme/en/unsubscribe/[redacted]",
    );
    expect(redactLogPathname("/acme/en/verify/abc123")).toBe(
      "/acme/en/verify/[redacted]",
    );
  });

  test("masks only the token segment, keeping the rest of the path", () => {
    expect(redactLogPathname("/acme/en/manage/abc123/extra")).toBe(
      "/acme/en/manage/[redacted]/extra",
    );
  });

  test("leaves the route index page and unrelated paths untouched", () => {
    expect(redactLogPathname("/acme/en/manage")).toBe("/acme/en/manage");
    expect(redactLogPathname("/acme/en/manage/")).toBe("/acme/en/manage/");
    expect(redactLogPathname("/acme/en/events/report/1")).toBe(
      "/acme/en/events/report/1",
    );
    expect(redactLogPathname("/")).toBe("/");
  });
});

describe("redactLogUrl", () => {
  test("undefined (passthrough action) → null", () => {
    expect(redactLogUrl(undefined)).toBeNull();
  });

  test("masks the page password carried by the rewrite", () => {
    expect(
      redactLogUrl(new URL("https://acme.stpg.dev/acme/en?pw=hunter2")),
    ).toBe("https://acme.stpg.dev/acme/en?pw=%5Bredacted%5D");
  });

  test("masks the redirect param, which echoes the requested path", () => {
    expect(
      redactLogUrl(
        new URL(
          "https://acme.stpg.dev/acme/login?redirect=%2Facme%2Fen%2Fmanage%2Fabc123",
        ),
      ),
    ).toBe("https://acme.stpg.dev/acme/login?redirect=%5Bredacted%5D");
  });

  test("masks the token segment of a rewrite target", () => {
    expect(
      redactLogUrl(new URL("https://acme.stpg.dev/acme/en/manage/abc123")),
    ).toBe("https://acme.stpg.dev/acme/en/manage/[redacted]");
  });

  test("keeps non-secret params readable", () => {
    expect(
      redactLogUrl(new URL("https://acme.stpg.dev/acme/en?tab=open&pw=s3cret")),
    ).toBe("https://acme.stpg.dev/acme/en?tab=open&pw=%5Bredacted%5D");
  });

  test("does not mutate the action URL it is handed", () => {
    const url = new URL(
      "https://acme.stpg.dev/acme/en/manage/abc123?pw=s3cret",
    );
    redactLogUrl(url);
    expect(url.toString()).toBe(
      "https://acme.stpg.dev/acme/en/manage/abc123?pw=s3cret",
    );
  });
});
