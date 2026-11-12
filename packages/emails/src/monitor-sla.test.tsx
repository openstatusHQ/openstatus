/** @jsxRuntime automatic @jsxImportSource react */

import "./test-preload.ts";
import { render } from "react-email";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { POSTAL_ADDRESS } from "../emails/_components/footer";
import MonitorSlaMissedEmail, {
  formatSlaTarget,
  formatSlaUptime,
  monitorSlaMissedSubject,
} from "../emails/monitor-sla-missed";
import { sendMonitorSlaMissed } from "./monitor-sla";
import { delivery } from "./send";
import { stubResendSend } from "./test-resend";

const props = MonitorSlaMissedEmail.PreviewProps;

describe("monitor SLA missed email", () => {
  test("subject names the monitor when one missed, the count otherwise", () => {
    expect(monitorSlaMissedSubject(props)).toBe(
      "2 monitors missed Partner contract in October 2026",
    );
    expect(
      monitorSlaMissedSubject({ ...props, monitors: [props.monitors[0]] }),
    ).toBe("Checkout API missed Partner contract in October 2026");
  });

  test("uptime is floored to three decimals, targets drop trailing zeros", () => {
    expect(formatSlaUptime(99_499)).toBe("99.499%");
    expect(formatSlaUptime(98_004)).toBe("98.004%");
    expect(formatSlaUptime(100_000)).toBe("100.000%");
    expect(formatSlaTarget(99_500)).toBe("99.5%");
    expect(formatSlaTarget(99_000)).toBe("99%");
    expect(formatSlaTarget(99_950)).toBe("99.95%");
  });

  test("lists each missed monitor against its target and links the policy", async () => {
    const html = await render(<MonitorSlaMissedEmail {...props} />);
    expect(html).toContain("Checkout API");
    expect(html).toContain("99.120%");
    expect(html).toContain("98.004%");
    expect(html).toContain("target 99.5%");
    expect(html).toContain("TARGET MISSED");
    expect(html).toContain(
      'href="https://app.openstatus.dev/sla-policies/monitors/1"',
    );
    expect(html).toContain("You get this because you own this workspace.");
    expect(html).toContain("max-width:600px");
    expect(html).toContain(POSTAL_ADDRESS);
    expect(html).not.toMatch(/>[^<]*OpenStatus[^<]*</);
    expect(html).not.toMatch(/display:\s?(-webkit-)?(inline-)?(flex|grid)/);
  });
});

describe("sendMonitorSlaMissed", () => {
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

  test("sends one email to the owners with the claim's idempotency key", async () => {
    const id = await sendMonitorSlaMissed({
      ...props,
      to: ["a@acme.dev", "b@acme.dev"],
      idempotencyKey: "monitor-sla-miss:1:2026-10-01",
    });
    expect(id).toBe("email_1");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      to: ["a@acme.dev", "b@acme.dev"],
      subject: "2 monitors missed Partner contract in October 2026",
      replyTo: "ping@openstatus.dev",
    });
    expect(send.mock.calls[0][1]).toEqual({
      idempotencyKey: "monitor-sla-miss:1:2026-10-01",
    });
  });

  test("nothing without recipients or outside production", async () => {
    await sendMonitorSlaMissed({ ...props, to: [], idempotencyKey: "k" });
    enabled.mockImplementation(() => false);
    await sendMonitorSlaMissed({
      ...props,
      to: ["a@acme.dev"],
      idempotencyKey: "k",
    });
    expect(send).toHaveBeenCalledTimes(0);
  });
});
