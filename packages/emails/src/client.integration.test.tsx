/** @jsxImportSource react */

import { describe, expect, test } from "bun:test";
import { render } from "@react-email/render";
import StatusReportEmail from "../emails/status-report";

describe("Status Report Email - Unsubscribe Link in Body", () => {
  const unsubscribeUrl =
    "https://openstatus.openstatus.dev/unsubscribe/test-token";

  test("should include unsubscribe link in email body when URL is provided", async () => {
    const html = await render(
      <StatusReportEmail
        pageTitle="Test Page"
        reportTitle="Test Report"
        status="investigating"
        date={new Date().toISOString()}
        message="Test message"
        monitors={["Monitor 1"]}
        unsubscribeUrl={unsubscribeUrl}
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
        monitors={["Monitor 1"]}
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
        monitors={["Monitor 1"]}
        unsubscribeUrl={unsubscribeUrl}
      />,
    );

    // Check that the URL is in an href attribute
    expect(html).toContain(`href="${unsubscribeUrl}"`);
  });

  test("should display unsubscribe link with proper styling", async () => {
    const html = await render(
      <StatusReportEmail
        pageTitle="Test Page"
        reportTitle="Test Report"
        status="investigating"
        date={new Date().toISOString()}
        message="Test message"
        monitors={["Monitor 1"]}
        unsubscribeUrl={unsubscribeUrl}
      />,
    );

    // Check for muted styling (gray color for footer)
    expect(html).toContain("#6b7280");
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
      monitors: ["API", "Web"],
      unsubscribeUrl: "https://openstatus.openstatus.dev/unsubscribe/test",
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
          monitors={[]}
          unsubscribeUrl="https://example.com/unsubscribe"
        />,
      );

      // Should render without errors and contain the status
      // Note: status is rendered lowercase in HTML with text-transform: uppercase CSS
      expect(html).toContain(status);
    }
  });
});
