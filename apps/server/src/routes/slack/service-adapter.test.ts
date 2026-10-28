import { describe, expect, test } from "@openstatus/test-utils";

import { permalinkFor } from "./service-adapter";

function slackWith(getPermalink: () => Promise<{ permalink?: string }>) {
  return { chat: { getPermalink } } as unknown as Parameters<
    typeof permalinkFor
  >[0];
}

describe("permalinkFor", () => {
  test("returns the permalink", async () => {
    const slack = slackWith(() =>
      Promise.resolve({ permalink: "https://slack.test/archives/C1/p1" }),
    );
    expect(await permalinkFor(slack, "C1", "1.0")).toBe(
      "https://slack.test/archives/C1/p1",
    );
  });

  test("gives up after the timeout instead of holding the caller", async () => {
    const slack = slackWith(() => new Promise(() => {}));
    expect(await permalinkFor(slack, "C1", "1.0", 10)).toBeUndefined();
  });

  test("swallows API errors", async () => {
    const slack = slackWith(() => Promise.reject(new Error("ratelimited")));
    expect(await permalinkFor(slack, "C1", "1.0")).toBeUndefined();
  });
});
