/** @jsxImportSource react */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { render } from "react-email";

import StatusReportEmail from "../emails/status-report";
import { EmailClient, statusReportSubject } from "./client";

describe("Status Report Email - Unsubscribe Link in Body", () => {
  const unsubscribeUrl =
    "https://openstatus.openstatus.dev/unsubscribe/test-token";
  const manageUrl = "https://openstatus.openstatus.dev/manage/test-token";

  test("should include unsubscribe link in email body when URL is provided", async () => {
    const html = await render(
      <StatusReportEmail
        pageTitle="Test Page"
        reportTitle="Test Report"
        status="investigating"
        date={new Date().toISOString()}
        message="Test message"
        pageComponents={["Monitor 1"]}
        unsubscribeUrl={unsubscribeUrl}
        manageUrl={manageUrl}
      />,
    );

    expect(html).toContain(unsubscribeUrl);
    expect(html).toContain("Unsubscribe");
  });

  test("should not include unsubscribe section when URL is not provided", async () => {
    const html = await render(
      <StatusReportEmail
        pageTitle="Test Page"
        reportTitle="Test Report"
        status="investigating"
        date={new Date().toISOString()}
        message="Test message"
        pageComponents={["Monitor 1"]}
        manageUrl={manageUrl}
      />,
    );

    // Should not contain the unsubscribe text when no URL provided
    expect(html).not.toContain("from these notifications");
  });

  test("should render unsubscribe link as clickable", async () => {
    const html = await render(
      <StatusReportEmail
        pageTitle="Test Page"
        reportTitle="Test Report"
        status="investigating"
        date={new Date().toISOString()}
        message="Test message"
        pageComponents={["Monitor 1"]}
        unsubscribeUrl={unsubscribeUrl}
        manageUrl={manageUrl}
      />,
    );

    // Check that the URL is in an href attribute
    expect(html).toContain(`href="${unsubscribeUrl}"`);
  });

  test("preserves {{variable}} placeholders in href for autosend dynamicData", async () => {
    const html = await render(
      <StatusReportEmail
        pageTitle="Test Page"
        reportTitle="Test Report"
        status="investigating"
        date={new Date().toISOString()}
        message="Test message"
        pageComponents={["Monitor 1"]}
        unsubscribeUrl="{{unsubscribeUrl}}"
        manageUrl="{{manageUrl}}"
      />,
    );

    // React escapes HTML entities but does not percent-encode, so braces survive intact
    expect(html).toContain(`href="{{unsubscribeUrl}}"`);
    expect(html).toContain(`href="{{manageUrl}}"`);
  });

  test("should display unsubscribe link with proper styling", async () => {
    const html = await render(
      <StatusReportEmail
        pageTitle="Test Page"
        reportTitle="Test Report"
        status="investigating"
        date={new Date().toISOString()}
        message="Test message"
        pageComponents={["Monitor 1"]}
        unsubscribeUrl={unsubscribeUrl}
        manageUrl={manageUrl}
      />,
    );

    // Check for muted styling (gray color for footer)
    expect(html).toContain("#6b7280");
  });
});

describe("Status Report Email - Subject Line", () => {
  const reportTitle = "API Outage";

  test('prepends "RESOLVED:" only when status is "resolved"', () => {
    expect(statusReportSubject({ status: "resolved", reportTitle })).toBe(
      `RESOLVED: ${reportTitle}`,
    );
  });

  test('does not prepend "RESOLVED:" for any non-resolved status', () => {
    const nonResolved = [
      "investigating",
      "identified",
      "monitoring",
      "maintenance",
    ] as const;

    for (const status of nonResolved) {
      const subject = statusReportSubject({ status, reportTitle });
      expect(subject).toBe(reportTitle);
      expect(subject).not.toContain("RESOLVED:");
    }
  });
});

describe("Status Report Email - Email Content Validation", () => {
  test("should include all required email fields", async () => {
    const props = {
      pageTitle: "OpenStatus",
      reportTitle: "API Outage",
      status: "investigating" as const,
      date: "2024-01-15T10:00:00.000Z",
      message: "We are investigating the issue",
      pageComponents: ["API", "Web"],
      unsubscribeUrl: "https://openstatus.openstatus.dev/unsubscribe/test",
      manageUrl: "https://openstatus.openstatus.dev/manage/test",
    };

    const html = await render(<StatusReportEmail {...props} />);

    expect(html).toContain(props.pageTitle);
    expect(html).toContain(props.reportTitle);
    expect(html).toContain(props.message);
    expect(html).toContain("API");
    expect(html).toContain("Web");
    expect(html).toContain(props.unsubscribeUrl);
  });

  test("should handle all status types correctly", async () => {
    const statuses = [
      "investigating",
      "identified",
      "monitoring",
      "resolved",
      "maintenance",
    ] as const;

    for (const status of statuses) {
      const html = await render(
        <StatusReportEmail
          pageTitle="Test"
          reportTitle="Test Report"
          status={status}
          date={new Date().toISOString()}
          message="Test"
          pageComponents={[]}
          unsubscribeUrl="https://example.com/unsubscribe"
          manageUrl="https://example.com/manage"
        />,
      );

      // Should render without errors and contain the status
      // Note: status is rendered lowercase in HTML with text-transform: uppercase CSS
      expect(html).toContain(status);
    }
  });
});

describe("EmailClient - autosend payload mapping", () => {
  const realFetch = globalThis.fetch;
  const realEnv = process.env.NODE_ENV;
  let calls: Array<{ url: string; body: Record<string, unknown> }>;

  function respondWith(status: number, body: unknown) {
    globalThis.fetch = (async (url: unknown, init: { body?: string }) => {
      calls.push({
        url: String(url),
        body: init?.body ? JSON.parse(init.body) : {},
      });
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
  }

  beforeEach(() => {
    calls = [];
    // bypass the `NODE_ENV === "development"` early-return so the real path runs
    process.env.NODE_ENV = "production";
    respondWith(200, {
      data: {
        batchId: "b_1",
        totalRecipients: 1,
        successCount: 1,
        failedCount: 0,
        emailId: "e_1",
      },
    });
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    process.env.NODE_ENV = realEnv;
  });

  test("single send maps a `Name <email>` from into {name,email} + {email} to", async () => {
    const client = new EmailClient({ apiKey: "test" });
    await client.sendMonitorAlert({
      to: "dev@example.com",
      name: "My Monitor",
      type: "alert",
      // biome-ignore lint/suspicious/noExplicitAny: minimal MonitorAlertProps for the test
    } as any);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/mails/send");
    expect(calls[0].body.from).toEqual({
      name: "OpenStatus",
      email: "notifications@notifications.openstatus.dev",
    });
    expect(calls[0].body.to).toEqual({ email: "dev@example.com" });
  });

  test("status report fan-out uses bulk with per-recipient dynamicData + placeholder html", async () => {
    const client = new EmailClient({ apiKey: "test" });
    await client.sendStatusReportUpdate({
      pageTitle: "Acme",
      reportTitle: "Incident",
      status: "investigating",
      date: new Date().toISOString(),
      message: "We are investigating",
      pageComponents: ["API"],
      pageSlug: "acme",
      subscribers: [{ email: "a@example.com", token: "tok1" }],
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/mails/bulk");
    expect(calls[0].body.from).toEqual({
      name: "Acme",
      email: "notifications@notifications.openstatus.dev",
    });
    expect(calls[0].body.recipients).toEqual([
      {
        email: "a@example.com",
        dynamicData: {
          unsubscribeUrl: "https://acme.openstatus.dev/unsubscribe/tok1",
          manageUrl: "https://acme.openstatus.dev/manage/tok1",
        },
      },
    ]);
    // rendered once with the placeholder tokens intact for server-side substitution
    expect(String(calls[0].body.html)).toContain("{{unsubscribeUrl}}");
  });

  test("batched send throws on 429 so the cron halts", async () => {
    respondWith(429, { message: "rate limit exceeded" });
    const client = new EmailClient({ apiKey: "test" });
    await expect(
      client.sendFollowUpBatched({ to: ["a@example.com"] }),
    ).rejects.toThrow();
  });

  test("batched send swallows non-429 errors and does not throw", async () => {
    respondWith(500, { message: "server error" });
    const client = new EmailClient({ apiKey: "test" });
    await expect(
      client.sendFollowUpBatched({ to: ["a@example.com"] }),
    ).resolves.toBeUndefined();
  });
});
