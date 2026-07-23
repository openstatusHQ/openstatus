import { expect } from "@std/expect";
import { describe, it as test } from "@std/testing/bdd";

import type { PageUpdate, Subscription } from "../types";
import { buildReplyMessage, buildRootMessage } from "./slack-blocks";

function makeSub(over: Partial<Subscription> = {}): Subscription {
  return {
    id: 1,
    pageId: 1,
    pageName: "Acme Status",
    pageSlug: "acme",
    customDomain: null,
    componentIds: [],
    channelType: "slack",
    slackChannelId: "C1",
    ...over,
  };
}

function makeUpdate(over: Partial<PageUpdate> = {}): PageUpdate {
  return {
    id: 10,
    pageId: 1,
    title: "API degraded",
    status: "investigating",
    message: "We are investigating elevated errors.",
    pageComponentIds: [],
    pageComponents: [],
    date: "2026-01-01T10:00:00.000Z",
    updateId: 100,
    ...over,
  };
}

describe("buildRootMessage", () => {
  test("investigating header carries the magnifier emoji + label", () => {
    const root = buildRootMessage(makeUpdate(), makeSub());
    expect(root.text).toContain("🔍");
    expect(root.text).toContain("Investigating");
    expect(root.text).toContain("API degraded");
    expect(root.attachments[0]?.color).toBeDefined();
  });

  test("resolved switches to the check mark and green bar", () => {
    const resolvedRoot = buildRootMessage(
      makeUpdate({ status: "resolved" }),
      makeSub(),
    );
    const investigatingRoot = buildRootMessage(makeUpdate(), makeSub());
    expect(resolvedRoot.text).toContain("✅");
    expect(resolvedRoot.text).toContain("Resolved");
    expect(resolvedRoot.attachments[0]?.color).not.toBe(
      investigatingRoot.attachments[0]?.color,
    );
  });

  test("uses the custom domain origin when present", () => {
    const root = buildRootMessage(
      makeUpdate(),
      makeSub({ customDomain: "status.acme.com" }),
    );
    expect(JSON.stringify(root.attachments)).toContain(
      "https://status.acme.com",
    );
  });
});

describe("buildReplyMessage", () => {
  test("reply carries status label and message", () => {
    const reply = buildReplyMessage(
      makeUpdate({ status: "monitoring", message: "Fix deployed." }),
    );
    expect(reply.text).toContain("Monitoring");
    expect(reply.text).toContain("Fix deployed.");
    expect(reply.blocks.length).toBeGreaterThan(0);
  });
});
