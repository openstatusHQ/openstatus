/** @jsxRuntime automatic @jsxImportSource react */

import "./test-preload.ts";
import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, type Stub, stub } from "@std/testing/mock";
import { render } from "react-email";

import type { PlanLoss } from "../emails/_components/plan-loss";
import CancellationScheduledEmail from "../emails/cancellation-scheduled";
import MemberRemovedEmail from "../emails/member-removed";
import PlanDowngradedEmail, {
  planDowngradedSubject,
} from "../emails/plan-downgraded";
import PlanEndingSoonEmail, {
  planEndingSoonSubject,
} from "../emails/plan-ending-soon";
import TrialEndingEmail from "../emails/trial-ending";
import {
  billingRecipients,
  planLossLines,
  reminderScheduledAt,
  schedulePlanEndingSoon,
  sendCancellationScheduled,
  sendMemberRemoved,
  sendPlanDowngraded,
  sendTrialEnding,
} from "./billing";
import { cancelScheduledEmail, delivery, resend, sendEmail } from "./send";

const loss = {
  monitorsDeactivated: 11,
  pagesDeleted: ["Acme API", "Acme EU"],
  keptPageTitle: "Acme",
  notificationsDeleted: 3,
  invitationsDeleted: 1,
  membersRemoved: 4,
  customDomains: ["status.acme.dev"],
  sso: true,
} satisfies PlanLoss;

const nothing = {
  monitorsDeactivated: 0,
  pagesDeleted: [],
  keptPageTitle: null,
  notificationsDeleted: 0,
  invitationsDeleted: 0,
  membersRemoved: 0,
  customDomains: [],
  sso: false,
} satisfies PlanLoss;

const endsAt = new Date("2026-09-25T00:00:00Z");

describe("billing templates", () => {
  test("plan-downgraded names deleted pages and counts everything else", async () => {
    const props = { workspaceSlug: "acme-dev", previousPlan: "team", loss };
    const html = await render(<PlanDowngradedEmail {...props} />);
    expect(html).toContain("ACCOUNT CHANGE");
    expect(html).toContain("acme-dev");
    expect(html).toContain("team → free");
    expect(html).toContain("Acme API, Acme EU");
    expect(html).toContain("Deleted status pages cannot be restored");
    expect(html).toContain("11 monitors, oldest stays active");
    expect(html).toContain("4 members");
    expect(html).toContain("status.acme.dev");
    expect(html).toContain("Off, IdP configuration kept");
    expect(html).toContain("workspace owners and the billing contact");
    expect(html).toContain("Co-founder, openstatus");
    expect(html).toContain(
      'href="https://app.openstatus.dev/settings/billing"',
    );
    expect(planDowngradedSubject(props)).toBe(
      "Your workspace is on the free plan — 2 status pages deleted",
    );
  });

  test("plan-downgraded with nothing trimmed drops every loss row", async () => {
    const props = {
      workspaceSlug: "acme-dev",
      previousPlan: "starter",
      loss: nothing,
    };
    const html = await render(<PlanDowngradedEmail {...props} />);
    expect(html).toContain("No status page was deleted");
    expect(html).not.toContain("Status pages deleted");
    expect(html).not.toContain("Members removed");
    expect(html).not.toContain("SAML SSO");
    expect(planDowngradedSubject(props)).toBe(
      "Your workspace is on the free plan — here is what changed",
    );
  });

  test("plan-ending-soon is dated and in the future tense", async () => {
    const props = { workspaceSlug: "acme-dev", plan: "team", endsAt, loss };
    const html = await render(<PlanEndingSoonEmail {...props} />);
    expect(html).toContain("ACTION NEEDED");
    expect(html).toContain("Your team plan ends on Friday 25 September");
    expect(html).toContain("Fri 25 Sep 2026");
    expect(html).toContain("Status pages that get deleted");
    expect(html).toContain("Resume subscription");
    expect(planEndingSoonSubject(props)).toBe(
      "Your team plan ends on 25 Sep — resume to keep everything",
    );
  });

  test("member-removed: one line, who to ask, no CTA", async () => {
    const html = await render(
      <MemberRemovedEmail
        workspaceName="Acme"
        reason="downgrade"
        owners={["max@acme.dev"]}
      />,
    );
    expect(html).toContain("You were removed from Acme");
    expect(html).toContain("subscription ended");
    expect(html).toContain("max@acme.dev");
    expect(html).not.toContain("app.openstatus.dev");

    const manual = await render(
      <MemberRemovedEmail workspaceName="Acme" reason="manual" owners={[]} />,
    );
    expect(manual).toContain("A workspace owner removed you");
    expect(manual).not.toContain("Ask for access");
  });

  test("cancellation-scheduled is raw: no layout, date, losses, resume link", async () => {
    const html = await render(
      <CancellationScheduledEmail
        plan="team"
        endsAt={endsAt}
        losses={planLossLines(loss)}
      />,
    );
    expect(html).toContain("Fri 25 Sep 2026");
    expect(html).toContain("2 status pages get deleted (Acme API, Acme EU)");
    expect(html).toContain("4 members lose access");
    expect(html).toContain("what made you cancel?");
    expect(html).toContain(
      'href="https://app.openstatus.dev/settings/billing"',
    );
    expect(html).not.toContain("max-width:600px");

    const bare = await render(
      <CancellationScheduledEmail plan="team" endsAt={endsAt} losses={[]} />,
    );
    expect(bare).not.toContain("moves to the free plan");
  });

  test("trial-ending says what gets removed", async () => {
    const html = await render(<TrialEndingEmail trialEnd={endsAt} />);
    expect(html).toContain("Fri 25 Sep 2026");
    expect(html).toContain("all but one status page are");
    expect(html).not.toContain("max-width:600px");
  });

  test("loss lines use singular forms", () => {
    expect(
      planLossLines({
        ...nothing,
        pagesDeleted: ["A"],
        monitorsDeactivated: 1,
        membersRemoved: 1,
      }),
    ).toEqual([
      "1 status page gets deleted (A)",
      "1 monitor gets paused",
      "1 member loses access",
    ]);
  });

  test("loss lines cover every destructive change", () => {
    expect(
      planLossLines({
        ...nothing,
        invitationsDeleted: 2,
        notificationsDeleted: 1,
        customDomains: ["a.dev", "b.dev"],
        sso: true,
      }),
    ).toEqual([
      "2 pending invitations get deleted",
      "1 notification channel gets removed",
      "the custom domains a.dev, b.dev are released",
      "SAML SSO turns off",
    ]);
  });

  test("custom domain label follows the count", async () => {
    const one = await render(
      <PlanDowngradedEmail
        workspaceSlug="a"
        previousPlan="team"
        loss={{ ...nothing, customDomains: ["a.dev"] }}
      />,
    );
    expect(one).toContain("Custom domain released");
    const two = await render(
      <PlanDowngradedEmail
        workspaceSlug="a"
        previousPlan="team"
        loss={{ ...nothing, customDomains: ["a.dev", "b.dev"] }}
      />,
    );
    expect(two).toContain("Custom domains released");
  });
});

describe("billingRecipients", () => {
  test("owners + customer, case-insensitive dedupe, empties dropped", () => {
    expect(
      billingRecipients(
        ["Max@Acme.dev", "", null, "  ", "thibault@acme.dev"],
        "max@acme.dev",
      ),
    ).toEqual(["Max@Acme.dev", "thibault@acme.dev"]);
    expect(billingRecipients([], "billing@acme.dev")).toEqual([
      "billing@acme.dev",
    ]);
    expect(billingRecipients([undefined], null)).toEqual([]);
  });
});

describe("reminderScheduledAt", () => {
  const now = new Date("2026-09-01T00:00:00Z");

  test("period end minus 3 days", () => {
    expect(reminderScheduledAt(endsAt, now)?.toISOString()).toBe(
      "2026-09-22T00:00:00.000Z",
    );
  });

  test("null inside the lead window and beyond Resend's 30 days", () => {
    expect(reminderScheduledAt(new Date("2026-09-03T00:00:00Z"), now)).toBe(
      null,
    );
    expect(reminderScheduledAt(new Date("2027-03-01T00:00:00Z"), now)).toBe(
      null,
    );
  });
});

describe("send plumbing", () => {
  let send: Stub, batch: Stub, cancel: Stub, enabled: Stub;
  // safe because the verbs only read `data.id` and `error.name`
  const result = (value: unknown) => Promise.resolve(value as never);
  const ok = { data: { id: "email_123" }, error: null };

  beforeEach(() => {
    enabled = stub(delivery, "enabled", () => true);
    send = stub(resend.emails, "send", () => result(ok));
    batch = stub(resend.batch, "send", () => result(ok));
    cancel = stub(resend.emails, "cancel", () => result(ok));
  });

  afterEach(() => {
    for (const s of [enabled, send, batch, cancel]) s.restore();
  });

  const email = {
    from: "a <a@openstatus.dev>",
    to: ["b@example.com"],
    subject: "s",
    react: <TrialEndingEmail trialEnd={endsAt} />,
  };

  test("sendEmail forwards idempotencyKey and scheduledAt, returns the id", async () => {
    const id = await sendEmail(
      { ...email, reply_to: "r@openstatus.dev" },
      { idempotencyKey: "k", scheduledAt: "2026-09-22T00:00:00.000Z" },
    );
    expect(id).toBe("email_123");
    expect(send.calls[0].args[0].scheduledAt).toBe("2026-09-22T00:00:00.000Z");
    expect(send.calls[0].args[0].replyTo).toBe("r@openstatus.dev");
    expect(send.calls[0].args[1]).toEqual({ idempotencyKey: "k" });
  });

  test("sendEmail omits both when not given", async () => {
    await sendEmail(email);
    expect("scheduledAt" in send.calls[0].args[0]).toBe(false);
    expect(send.calls[0].args[1]).toBeUndefined();
  });

  test("sendEmail does nothing outside production", async () => {
    enabled.restore();
    enabled = stub(delivery, "enabled", () => false);
    expect(await sendEmail(email)).toBeUndefined();
    assertSpyCalls(send, 0);
  });

  test("an idempotency conflict or Resend error never throws", async () => {
    for (const name of ["invalid_idempotent_request", "application_error"]) {
      send.restore();
      send = stub(resend.emails, "send", () =>
        result({ data: null, error: { name } }),
      );
      expect(await sendEmail(email, { idempotencyKey: "k" })).toBeUndefined();
      assertSpyCalls(send, 1);
    }
  });

  test("cancelScheduledEmail wraps emails.cancel and reports success", async () => {
    expect(await cancelScheduledEmail("email_123")).toBe(true);
    expect(cancel.calls[0].args[0]).toBe("email_123");

    cancel.restore();
    cancel = stub(resend.emails, "cancel", () =>
      result({ data: null, error: { name: "application_error" } }),
    );
    expect(await cancelScheduledEmail("email_123")).toBe(false);
  });

  test("sendMemberRemoved chunks at Resend's 100-email batch limit", async () => {
    await sendMemberRemoved({
      to: Array.from({ length: 250 }, (_, i) => `m${i}@acme.dev`),
      idempotencyKey: "stripe:evt_1:member-removed",
      workspaceName: "Acme",
      reason: "downgrade",
      owners: [],
    });
    assertSpyCalls(batch, 3);
    expect(batch.calls.map((c) => c.args[0].length)).toEqual([100, 100, 50]);
    expect(batch.calls.map((c) => c.args[1].idempotencyKey)).toEqual([
      "stripe:evt_1:member-removed:0",
      "stripe:evt_1:member-removed:1",
      "stripe:evt_1:member-removed:2",
    ]);
  });

  test("a batch error is swallowed, not thrown", async () => {
    batch.restore();
    batch = stub(resend.batch, "send", () =>
      result({ data: null, error: { name: "application_error" } }),
    );
    await sendMemberRemoved({
      to: ["a@acme.dev"],
      workspaceName: "Acme",
      reason: "downgrade",
      owners: [],
    });
    assertSpyCalls(batch, 1);
  });

  test("sendPlanDowngraded", async () => {
    await sendPlanDowngraded({
      to: ["max@acme.dev"],
      eventId: "evt_1",
      workspaceSlug: "acme-dev",
      previousPlan: "team",
      loss,
    });
    const [payload, options] = send.calls[0].args;
    expect(payload.to).toEqual(["max@acme.dev"]);
    expect(payload.from).toBe(
      "Thibault from openstatus <thibault@notifications.openstatus.dev>",
    );
    expect(payload.replyTo).toBe("thibault@openstatus.dev");
    expect(payload.subject).toBe(
      "Your workspace is on the free plan — 2 status pages deleted",
    );
    expect(options).toEqual({ idempotencyKey: "stripe:evt_1:plan-downgraded" });
  });

  test("sendMemberRemoved batches one mail per member under one key", async () => {
    await sendMemberRemoved({
      to: ["a@acme.dev", "b@acme.dev"],
      idempotencyKey: "stripe:evt_1:member-removed",
      workspaceName: "Acme",
      reason: "downgrade",
      owners: ["max@acme.dev"],
    });
    const [emails, options] = batch.calls[0].args;
    expect(emails.map((e: { to: string }) => e.to)).toEqual([
      "a@acme.dev",
      "b@acme.dev",
    ]);
    expect(emails[0].from).toBe(
      "openstatus <notifications@notifications.openstatus.dev>",
    );
    expect(emails[0].replyTo).toBe("ping@openstatus.dev");
    expect(emails[0].subject).toBe(
      "You no longer have access to Acme on openstatus",
    );
    expect(emails[0].html).toContain("max@acme.dev");
    expect(options).toEqual({
      idempotencyKey: "stripe:evt_1:member-removed:0",
    });
  });

  test("sendCancellationScheduled is raw, from the root domain", async () => {
    await sendCancellationScheduled({
      to: ["max@acme.dev"],
      eventId: "evt_2",
      plan: "team",
      endsAt,
      loss,
    });
    const [payload, options] = send.calls[0].args;
    expect(payload.from).toBe(
      "Thibault from openstatus <thibault@openstatus.dev>",
    );
    expect(payload.subject).toBe("Your openstatus cancellation");
    expect(options).toEqual({
      idempotencyKey: "stripe:evt_2:cancellation-scheduled",
    });
  });

  test("schedulePlanEndingSoon schedules 3 days before and returns the id", async () => {
    const id = await schedulePlanEndingSoon({
      to: ["max@acme.dev"],
      eventId: "evt_2",
      workspaceSlug: "acme-dev",
      plan: "team",
      endsAt,
      loss,
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(id).toBe("email_123");
    const [payload, options] = send.calls[0].args;
    expect(payload.scheduledAt).toBe("2026-09-22T00:00:00.000Z");
    expect(options).toEqual({
      idempotencyKey: "stripe:evt_2:plan-ending-soon",
    });
  });

  test("schedulePlanEndingSoon skips a period end beyond 30 days", async () => {
    const id = await schedulePlanEndingSoon({
      to: ["max@acme.dev"],
      eventId: "evt_2",
      workspaceSlug: "acme-dev",
      plan: "team",
      endsAt: new Date("2027-03-01T00:00:00Z"),
      loss,
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(id).toBeUndefined();
    assertSpyCalls(send, 0);
  });

  test("sendTrialEnding", async () => {
    await sendTrialEnding({
      to: ["max@acme.dev"],
      eventId: "evt_3",
      trialEnd: endsAt,
    });
    const [payload, options] = send.calls[0].args;
    expect(payload.subject).toBe("Your openstatus trial ends soon");
    expect(options).toEqual({ idempotencyKey: "stripe:evt_3:trial-ending" });
  });

  test("no verb sends without recipients", async () => {
    await sendPlanDowngraded({
      to: [],
      eventId: "e",
      workspaceSlug: "a",
      previousPlan: "team",
      loss,
    });
    await sendMemberRemoved({
      to: [],
      workspaceName: "A",
      reason: "downgrade",
      owners: [],
    });
    await sendTrialEnding({ to: [], eventId: "e", trialEnd: endsAt });
    assertSpyCalls(send, 0);
    assertSpyCalls(batch, 0);
  });
});
