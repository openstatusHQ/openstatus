/** @jsxRuntime automatic @jsxImportSource react */

import "./test-preload.ts";
import { render } from "react-email";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { POSTAL_ADDRESS } from "../emails/_components/footer";
import IncidentSlaNoticeEmail, {
  incidentSlaNoticeSubject,
} from "../emails/incident-sla-notice";
import { sendIncidentSlaNotice } from "./incident";
import { delivery } from "./send";
import { stubResendSend } from "./test-resend";

const props = IncidentSlaNoticeEmail.PreviewProps;

describe("incident SLA notice email", () => {
  test("subject is the headline and the incident title", () => {
    expect(incidentSlaNoticeSubject(props)).toBe(
      "Response due soon: Checkout is failing",
    );
  });

  test("carries the wording, the target, and a link to the incident", async () => {
    const html = await render(<IncidentSlaNoticeEmail {...props} />);
    expect(html).toContain("RESPONSE DUE SOON");
    expect(html).toContain(
      "Checkout is failing (critical) has a 1h response target due Nov 11, 2026, 8:50 PM UTC.",
    );
    expect(html).toContain("Acknowledge it before then.");
    expect(html).toContain('href="https://app.openstatus.dev/incidents/1"');
    expect(html).toContain("Slack could not deliver");
    expect(html).toContain("max-width:600px");
    expect(html).toContain(POSTAL_ADDRESS);
    expect(html).not.toMatch(/>[^<]*OpenStatus[^<]*</);
    expect(html).not.toMatch(/display:\s?(-webkit-)?(inline-)?(flex|grid)/);
  });

  test("a miss without an action and the workspace fallback reason", async () => {
    const html = await render(
      <IncidentSlaNoticeEmail
        {...props}
        notice="miss"
        headline="Resolution target missed"
        action={null}
        audience="workspace"
      />,
    );
    expect(html).toContain("RESOLUTION TARGET MISSED");
    expect(html).not.toContain("Acknowledge it");
    expect(html).toContain("nobody is assigned to this incident");
  });
});

describe("sendIncidentSlaNotice", () => {
  let enabled: ReturnType<typeof vi.spyOn>;
  let send: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    enabled = vi.spyOn(delivery, "enabled").mockImplementation(() => true);
    send = stubResendSend();
  });

  afterEach(() => {
    enabled.mockRestore();
    send.mockRestore();
  });

  test("one email to every recipient with the claim's idempotency key", async () => {
    const id = await sendIncidentSlaNotice({
      ...props,
      to: ["a@acme.dev", "b@acme.dev"],
      idempotencyKey: "incident-sla-notice:1:response:warning:1",
    });
    expect(id).toBe("email_1");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      to: ["a@acme.dev", "b@acme.dev"],
      subject: "Response due soon: Checkout is failing",
      replyTo: "ping@openstatus.dev",
    });
    expect(send.mock.calls[0][1]).toEqual({
      idempotencyKey: "incident-sla-notice:1:response:warning:1",
    });
  });

  test("a Resend error throws so the caller does not count it as sent", async () => {
    send.mockImplementation(() =>
      Promise.resolve({
        data: null,
        error: { name: "validation_error", message: "too many recipients" },
      } as never),
    );
    await expect(
      sendIncidentSlaNotice({
        ...props,
        to: ["a@acme.dev"],
        idempotencyKey: "k",
      }),
    ).rejects.toThrow("too many recipients");
  });

  test("nothing without recipients or outside production", async () => {
    await sendIncidentSlaNotice({ ...props, to: [], idempotencyKey: "k" });
    enabled.mockImplementation(() => false);
    await sendIncidentSlaNotice({
      ...props,
      to: ["a@acme.dev"],
      idempotencyKey: "k",
    });
    expect(send).toHaveBeenCalledTimes(0);
  });
});
