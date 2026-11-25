import { db } from "@openstatus/db";
import { integration } from "@openstatus/db/src/schema";
import {
  createTestWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { describe, expect, test } from "vitest";

import { listSignupEmails, listSignupEmailsBySlack } from "../index.ts";

const window = () => ({
  from: new Date(Date.now() - 60_000),
  to: new Date(Date.now() + 60_000),
});

describe("signup emails", () => {
  test("splits members by whether their workspace has the Slack agent", async () => {
    const withSlack = await createTestWorkspace();
    const without = await createTestWorkspace();
    await db
      .insert(integration)
      .values({
        name: "slack-agent",
        workspaceId: withSlack.workspace.id,
        externalId: `T-${crypto.randomUUID()}`,
        data: "{}",
      })
      .run();

    const { slack, noSlack } = await listSignupEmailsBySlack(window());
    expect(slack).toContain(withSlack.user.email);
    expect(noSlack).toContain(without.user.email);
    expect(noSlack).not.toContain(withSlack.user.email);
  });

  test("skips accounts outside the window and without an email", async () => {
    const old = await createUser({ createdAt: new Date("2020-01-01") });
    const blank = await createUser({ email: " " });

    const emails = await listSignupEmails(window());
    expect(emails).not.toContain(old.email);
    expect(emails).not.toContain(blank.email);
  });
});
