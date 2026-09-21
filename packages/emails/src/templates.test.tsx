/** @jsxRuntime automatic @jsxImportSource react */

import "./test-preload.ts";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import { render } from "react-email";

import { Callout } from "../emails/_components/callout";
import { Footer, POSTAL_ADDRESS } from "../emails/_components/footer";
import { KeyValue } from "../emails/_components/key-value";
import { Layout, statusPageBrand } from "../emails/_components/layout";
import { renderMarkdown } from "../emails/_components/markdown";
import { Pill } from "../emails/_components/pill";
import { Steps } from "../emails/_components/steps";
import { tones } from "../emails/_components/styles";
import MonitorAlertEmail, {
  type MonitorAlertProps,
  monitorAlertPreheader,
  monitorAlertSubject,
} from "../emails/monitor-alert";
import MonitorDeactivationEmail, {
  monitorDeactivationSubject,
} from "../emails/monitor-deactivation";
import MonitorPausedEmail from "../emails/monitor-paused";
import PageSubscriptionEmail from "../emails/page-subscription";
import PrivateLocationAlertEmail, {
  privateLocationAlertSubject,
} from "../emails/private-location-alert";
import StatusPageMagicLinkEmail from "../emails/status-page-magic-link";
import StatusReportEmail, {
  type StatusReportProps,
  statusReportPreheader,
} from "../emails/status-report";
import TeamInvitationEmail from "../emails/team-invitation";

const alert = {
  type: "alert",
  monitorId: 42,
  name: "Ping Pong",
  url: "https://openstatus.dev/ping",
  method: "GET",
  status: "503",
  latency: "300 ms",
  region: "Amsterdam, Netherlands",
  timestamp: "2026-10-13T17:32:00Z",
  firstSeen: "2026-10-13T17:29:00Z",
  degradedAfter: 250,
  message: "upstream response time 0.302s",
} satisfies MonitorAlertProps;

const report = {
  pageTitle: "Acme",
  reportTitle: "API unavailable",
  status: "monitoring",
  date: "2026-09-18T12:37:00Z",
  reportStartedAt: "2026-09-18T10:23:00Z",
  updateIndex: 3,
  message: "We are on it.",
  pageComponents: ["API", "Runners"],
  componentImpacts: [
    { name: "API", impact: "partial_outage" },
    { name: "Runners", impact: "operational" },
  ],
  statusPageUrl: "https://acme.openstatus.dev",
  unsubscribeUrl: "https://acme.openstatus.dev/unsubscribe/t",
  manageUrl: "https://acme.openstatus.dev/manage/t",
} satisfies StatusReportProps;

describe("primitives", () => {
  test("pill maps tone to colour and uppercases its label", async () => {
    for (const tone of ["danger", "warning", "success", "neutral"] as const) {
      const html = await render(<Pill tone={tone}>down</Pill>);
      expect(html).toContain(tones[tone].text);
      expect(html).toContain(tones[tone].bg);
      expect(html).toContain("DOWN");
    }
  });

  test("key-value renders mono, tone, dot and hint", async () => {
    const html = await render(
      <KeyValue
        rows={[
          { label: "Request", value: "GET /ping", mono: true },
          {
            label: "Latency",
            value: "300 ms",
            tone: "warning",
            hint: "threshold 250 ms",
          },
          { label: "API", value: "Degraded", tone: "warning", dot: true },
        ]}
      />,
    );
    expect(html).toContain("ui-monospace");
    expect(html).toContain(tones.warning.text);
    expect(html).toContain(tones.warning.dot);
    expect(html).toContain("●");
    expect(html).toContain("threshold 250 ms");
  });

  test("key-value drops the value cell for null and undefined", async () => {
    for (const value of [null, undefined]) {
      const html = await render(<KeyValue rows={[{ label: "API", value }]} />);
      expect(html).toContain('colSpan="2"');
      expect(html).not.toContain('align="right"');
    }
    const html = await render(<KeyValue rows={[{ label: "API", value: 0 }]} />);
    expect(html).toContain('align="right"');
  });

  test("footer renders the reason, links only when given, and the address", async () => {
    const bare = await render(<Footer reason="Sent to workspace owners." />);
    expect(bare).toContain("Sent to workspace owners.");
    expect(bare).toContain(POSTAL_ADDRESS);
    expect(bare).not.toContain("Notification settings");
    expect(bare).not.toContain("Alert rule");

    const linked = await render(
      <Footer
        reason="Why."
        links={[{ label: "Unsubscribe", href: "https://x.dev/u" }]}
      />,
    );
    expect(linked).toContain('href="https://x.dev/u"');
  });

  test("footer alert-rule variant", async () => {
    const html = await render(<Footer rule="latency > 250ms" />);
    expect(html).toContain("Alert rule:");
    expect(html).toContain("latency &gt; 250ms");
  });

  test("callout tones", async () => {
    const success = await render(
      <Callout tone="success" title="Kept">
        body
      </Callout>,
    );
    expect(success).toContain(tones.success.bg);
    const neutral = await render(<Callout title="Kept">body</Callout>);
    expect(neutral).not.toContain(tones.success.bg);
  });

  test("steps render ordered numbers or dashes", async () => {
    const ordered = await render(<Steps label="Check" items={["a", "b"]} />);
    expect(ordered).toContain(">1.<");
    expect(ordered).toContain(">2.<");
    const dashed = await render(
      <Steps label="Doing" variant="dashed" items={["a"]} />,
    );
    expect(dashed).toContain("—");
    expect(dashed).not.toContain(">1.<");
  });

  test("layout sets the preheader, hosted logo and light colour scheme", async () => {
    const html = await render(<Layout preview="Second detail.">hi</Layout>);
    expect(html).toContain("Second detail.");
    expect(html).toContain("https://www.openstatus.dev/assets/logos/");
    expect(html).toContain('name="color-scheme"');
  });

  test("status page brand appends Status once", () => {
    expect(statusPageBrand("Acme", "https://a.dev").name).toBe("Acme Status");
    expect(statusPageBrand("Acme Status", "https://a.dev").name).toBe(
      "Acme Status",
    );
  });
});

describe("markdown", () => {
  test("tables are styled, task lists render without inputs", () => {
    const html = renderMarkdown("| a |\n|--|\n| 1 |\n\n- [x] done");
    expect(html).toContain("<td style=");
    expect(html).toContain("<th style=");
    expect(html).toContain("width:100%;table-layout:fixed");
    expect(html).toContain("☑ done");
    expect(html).not.toContain("<input");
  });

  test("raw HTML is escaped, block and inline", () => {
    const html = renderMarkdown(
      '<script>alert(1)</script>\n\ntext <img src=x onerror=alert(1)> <p style="position:fixed">x</p>',
    );
    expect(html).not.toMatch(/<(script|img|p style="position)/);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  test("quotes in a link destination cannot break out of href", () => {
    for (const source of [
      '<https://evil.com/x"onmouseover=alert(1)>',
      '[x](https://evil.com/x"onmouseover="alert(1))',
      '![a"onerror=alert(1)](https://ok.dev/i.png"onerror="alert(1))',
    ]) {
      const html = renderMarkdown(source);
      expect(html).not.toMatch(/\son\w+=/);
      expect(html).toContain("&quot;");
    }
  });

  test("only http(s) and mailto links survive; the label stays as text", () => {
    for (const source of [
      "[label](javascript:alert(1))",
      "[label](JaVaScRiPt:alert(1))",
      "[label](&#106;avascript:alert(1))",
      "[label](data:text/html,x)",
      "[label](vbscript:x)",
      "[label]: javascript:alert(1)\n\n[label]",
    ]) {
      const html = renderMarkdown(source);
      expect(html).not.toContain("<a ");
      expect(html).toContain("label");
    }
    expect(renderMarkdown("<https://a.dev/x>")).toContain(
      'href="https://a.dev/x"',
    );
    expect(renderMarkdown("<mailto:a@b.dev>")).toContain(
      'href="mailto:a@b.dev"',
    );
  });

  test("backslash-escaped backticks do not smuggle HTML", () => {
    const html = renderMarkdown("\\`<img src=x onerror=alert(1)>\\`");
    expect(html).not.toContain("<img");
  });

  test("code keeps its content readable and is escaped once", () => {
    const html = renderMarkdown('`<div class="a">` and R&amp;D');
    expect(html).toContain("&lt;div class=&quot;a&quot;&gt;");
    expect(html).not.toContain("&amp;lt;");
    expect(html).toContain("R&amp;D");
    expect(html).not.toContain("&amp;amp;");
  });

  test("generated tags get inline styles with a well-formed style attribute", () => {
    const html = renderMarkdown(
      "### Doing\n\n3. third\n\n- **bold**\n\n`code`",
    );
    expect(html).toMatch(/<h3 style="[^"]*text-transform:uppercase[^"]*">/);
    expect(html).toMatch(/<ol start="3" style="[^"]+">/);
    expect(html).toMatch(/<li style="[^"]+">/);
    expect(html).toMatch(/<strong style="[^"]+">bold/);
    expect(html).toMatch(/<code style="[^"]+">code<\/code>/);
  });

  test("images need https", () => {
    expect(renderMarkdown("![alt](https://a.dev/i.png)")).toContain(
      'src="https://a.dev/i.png"',
    );
    expect(renderMarkdown("![alt](http://a.dev/i.png)")).not.toContain("<img");
  });
});

describe("monitor alert", () => {
  test("region count replaces the single region", async () => {
    const many = { ...alert, affectedRegions: 5, totalRegions: 6 };
    const html = await render(<MonitorAlertEmail {...many} />);
    expect(html).toContain("5/6");
    expect(html).toContain("from 5/6 regions");
    expect(monitorAlertSubject(many)).toContain("from 5/6 regions");

    const one = await render(
      <MonitorAlertEmail {...alert} affectedRegions={1} totalRegions={6} />,
    );
    expect(one).toContain("1/6");
    expect(one).toContain(`from ${alert.region}`);
  });

  test("alert", async () => {
    const html = await render(<MonitorAlertEmail {...alert} />);
    expect(html).toContain("Ping Pong is down");
    expect(html).toContain("DOWN");
    expect(html).not.toContain("retries");
    expect(html).toContain("503");
    expect(html).toContain("GET https://openstatus.dev/ping");
    expect(html).toContain("Amsterdam, Netherlands");
    expect(html).toContain("13 Oct, 17:29 UTC");
    expect(html).toContain("13 Oct, 17:32 UTC");
    expect(html).toContain("upstream response time 0.302s");
    expect(html).toContain('href="https://app.openstatus.dev/monitors/42"');
    expect(html).toContain(
      'href="https://app.openstatus.dev/monitors/42/edit"',
    );
    expect(html).not.toContain("Alert rule");
  });

  test("degraded shows the threshold and the rule footer", async () => {
    const html = await render(
      <MonitorAlertEmail {...alert} type="degraded" status="200" />,
    );
    expect(html).toContain("Ping Pong is answering slowly");
    expect(html).toContain("DEGRADED");
    expect(html).toContain("threshold 250 ms");
    expect(html).toContain("latency &gt; 250ms");
    expect(html).toContain("Edit rule");
    expect(html).toContain("still returning 200");
  });

  test("recovery", async () => {
    const html = await render(
      <MonitorAlertEmail {...alert} type="recovery" message={undefined} />,
    );
    expect(html).toContain("Ping Pong is back up");
    expect(html).toContain("RECOVERED");
    expect(html).not.toContain("upstream response time");
  });

  test("optional rows disappear (TCP monitor, no incident)", async () => {
    const html = await render(
      <MonitorAlertEmail type="alert" name="TCP" latency="N/A" region="N/A" />,
    );
    expect(html).not.toContain("Response");
    expect(html).not.toContain("Latency");
    expect(html).not.toContain("First seen");
    expect(html).not.toContain("Edit notifications");
    expect(html).toContain('href="https://app.openstatus.dev/monitors"');
  });

  test("long messages are truncated", async () => {
    const html = await render(
      <MonitorAlertEmail {...alert} message={"x".repeat(600)} />,
    );
    expect(html).toContain(`${"x".repeat(400)}…`);
    expect(html).not.toContain("x".repeat(401));
  });

  test("subject and preheader", () => {
    expect(monitorAlertSubject(alert)).toBe(
      "Ping Pong is down — status 503 from Amsterdam, Netherlands",
    );
    expect(monitorAlertSubject({ ...alert, type: "degraded" })).toBe(
      "Ping Pong is slow — 300 ms from Amsterdam, Netherlands",
    );
    expect(monitorAlertSubject({ ...alert, type: "recovery" })).toBe(
      "Ping Pong recovered — 300 ms from Amsterdam, Netherlands",
    );
    expect(monitorAlertSubject({ type: "alert", region: "N/A" })).toBe(
      "Your monitor is down — check failed",
    );
    expect(monitorAlertPreheader({ ...alert, type: "degraded" })).toBe(
      "Above your 250 ms threshold.",
    );
    for (const type of ["alert", "degraded", "recovery"] as const) {
      const props = { ...alert, type };
      expect(monitorAlertPreheader(props)).not.toBe(monitorAlertSubject(props));
    }
  });
});

describe("private location alert", () => {
  const base = {
    locationName: "eu-west-private",
    lastSeenAt: "2026-07-23T10:00:00Z",
  };

  test("error shows the checklist and skipped monitors", async () => {
    const html = await render(
      <PrivateLocationAlertEmail {...base} status="error" monitorCount={4} />,
    );
    expect(html).toContain("UNHEALTHY");
    expect(html).toContain("eu-west-private");
    expect(html).toContain("are paused");
    expect(html).toContain("23 Jul, 10:00 UTC");
    expect(html).toContain("Checks skipped");
    expect(html).toContain("4 monitors");
    expect(html).toContain("Check, in this order");
    expect(html).toContain("you are a member of this workspace");
    expect(html).toContain("/settings/private-locations");
  });

  test("recovered drops the checklist; no monitors drops the row", async () => {
    const html = await render(
      <PrivateLocationAlertEmail {...base} status="recovered" />,
    );
    expect(html).toContain("RECOVERED");
    expect(html).toContain("are running again");
    expect(html).not.toContain("Check, in this order");
    expect(html).not.toContain("Checks resumed");
  });

  test("subject", () => {
    expect(privateLocationAlertSubject({ ...base, status: "error" })).toBe(
      'Checks paused — "eu-west-private" stopped reporting',
    );
    expect(privateLocationAlertSubject({ ...base, status: "recovered" })).toBe(
      'Checks resumed — "eu-west-private" is reporting again',
    );
  });
});

describe("status report", () => {
  test("eyebrow, components, markdown, links", async () => {
    const html = await render(<StatusReportEmail {...report} />);
    expect(html).toContain("Acme Status");
    expect(html).toContain("MONITORING");
    expect(html).toContain("Update 3 · 18 Sep, 12:37 UTC · 2h 14m in");
    expect(html).toContain("API unavailable");
    expect(html).toContain("Runners");
    expect(html).toContain("Partial outage");
    expect(html).toContain("Operational");
    expect(html).not.toContain("●");
    expect(html).toContain("We are on it.");
    expect(html).toContain('href="https://acme.openstatus.dev"');
    expect(html).toContain(`href="${report.unsubscribeUrl}"`);
    expect(html).toContain(`href="${report.manageUrl}"`);
    expect(html).not.toContain("openstatus.dev/assets/logos");
  });

  test("pill uses the status enum verbatim, one tone per status", async () => {
    const expected = {
      investigating: tones.danger,
      identified: tones.warning,
      monitoring: tones.info,
      resolved: tones.success,
      maintenance: tones.info,
    };
    for (const [status, tone] of Object.entries(expected)) {
      const html = await render(
        <StatusReportEmail
          {...report}
          status={status as StatusReportProps["status"]}
        />,
      );
      expect(html).toContain(status.toUpperCase());
      expect(html).toContain(tone.bg);
    }
  });

  test("unknown impact drops the value cell", async () => {
    const html = await render(
      <StatusReportEmail {...report} componentImpacts={undefined} />,
    );
    expect(html).toContain("Runners");
    expect(html).toContain('colSpan="2"');
    expect(html).not.toContain("Operational");
    expect(html).not.toContain("Partial outage");
  });

  test("optional blocks disappear", async () => {
    const html = await render(
      <StatusReportEmail
        {...report}
        pageComponents={[]}
        statusPageUrl={undefined}
        updateIndex={undefined}
        reportStartedAt={undefined}
      />,
    );
    expect(html).not.toContain("Update 3");
    expect(html).not.toContain("2h 14m in");
    expect(html).not.toContain("Follow on the status page");
    expect(html).not.toContain("●");
  });

  test("maintenance renders its window instead of a timestamp", async () => {
    const html = await render(
      <StatusReportEmail
        {...report}
        status="maintenance"
        date="Mon 21 Sep, 10:00 - 12:00"
      />,
    );
    expect(html).toContain("MAINTENANCE");
    expect(html).toContain("Window");
    expect(html).toContain("Mon 21 Sep, 10:00 - 12:00");
  });

  test("markdown headings and lists are styled, raw HTML is escaped", async () => {
    const html = await render(
      <StatusReportEmail
        {...report}
        message={
          "### What we're doing\n\n- Retrying\n\n<script>alert(1)</script><img src=x onerror=alert(1)>"
        }
      />,
    );
    expect(html).toMatch(/<h3 style="[^"]*text-transform:\s?uppercase/);
    expect(html).toMatch(/<li style="/);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });

  test("a crafted autolink cannot inject an attribute into the email", async () => {
    const html = await render(
      <StatusReportEmail
        {...report}
        message={
          '<https://evil.com/x"onmouseover=alert(1)> [x](javascript:alert(1))'
        }
      />,
    );
    expect(html).not.toMatch(/\sonmouseover=/);
    expect(html).not.toContain("javascript:");
    expect(html).toContain(
      'href="https://evil.com/x&quot;onmouseover=alert(1)"',
    );
  });

  test("autolinks and entities in the message survive escaping", async () => {
    const html = await render(
      <StatusReportEmail
        {...report}
        message="See <https://status.acme.dev/x> — R&amp;D"
      />,
    );
    expect(html).toContain('href="https://status.acme.dev/x"');
    expect(html).toContain("R&amp;D");
    expect(html).not.toContain("&amp;amp;");
  });

  test("maintenance without eyebrow items renders no empty eyebrow", async () => {
    const html = await render(
      <StatusReportEmail
        {...report}
        status="maintenance"
        date="Mon 21 Sep, 10:00 - 12:00"
        updateIndex={undefined}
        reportStartedAt={undefined}
      />,
    );
    expect(html).not.toMatch(/<p[^>]*letter-spacing:0\.12em[^>]*><\/p>/);
  });

  test("preheader never repeats the subject", () => {
    expect(statusReportPreheader(report)).toBe("Monitoring: API, Runners.");
    expect(statusReportPreheader({ ...report, status: "resolved" })).toBe(
      "Resolved for API, Runners.",
    );
    expect(
      statusReportPreheader({ ...report, pageComponents: [] }),
    ).not.toContain(report.reportTitle);
  });
});

describe("inactivity pause", () => {
  test("warning carries count, workspace, last sign-in, pause date and signature", async () => {
    const html = await render(
      <MonitorDeactivationEmail
        deactivateAt={new Date("2026-09-25T00:00:00Z")}
        monitorCount={3}
        workspaceSlug="acme-dev"
        lastSignIn={new Date("2026-07-21T00:00:00Z")}
      />,
    );
    expect(html).toContain("ACTION NEEDED");
    expect(html).toContain("3 monitors will pause on Friday 25 September");
    expect(html).toContain("Nothing gets deleted");
    expect(html).toContain("acme-dev");
    expect(html).toContain("Tue 21 Jul 2026");
    expect(html).toContain("Fri 25 Sep 2026");
    expect(html).toContain("Thibault");
    expect(html).toContain("Co-founder, openstatus");
  });

  test("warning without context falls back and drops the rows", async () => {
    const html = await render(
      <MonitorDeactivationEmail
        deactivateAt={new Date("2026-09-25T00:00:00Z")}
      />,
    );
    expect(html).toContain("Your monitors will pause on");
    expect(html).not.toContain("Workspace");
    expect(html).not.toContain("Last sign-in");
  });

  test("singular monitor", async () => {
    const html = await render(<MonitorPausedEmail monitorCount={1} />);
    expect(html).toContain("1 monitor has been paused");
  });

  test("paused", async () => {
    const html = await render(
      <MonitorPausedEmail monitorCount={3} workspaceSlug="acme-dev" />,
    );
    expect(html).toContain("3 monitors have been paused");
    expect(html).toContain("Nothing was deleted");
    expect(html).toContain("acme-dev");
    const bare = await render(<MonitorPausedEmail />);
    expect(bare).toContain("Your monitors have been paused");
    expect(bare).not.toContain("Workspace");
  });

  test("subject", () => {
    expect(
      monitorDeactivationSubject({
        deactivateAt: new Date("2026-09-25T00:00:00Z"),
      }),
    ).toBe("Your monitors pause on 25 Sep — one sign-in stops it");
  });
});

describe("account and status page mail", () => {
  test("team invitation", async () => {
    const html = await render(
      <TeamInvitationEmail
        token="tok"
        workspaceName="acme"
        invitedBy="max@openstatus.dev"
      />,
    );
    expect(html).toContain("Join acme on openstatus");
    expect(html).toContain("max@openstatus.dev");
    expect(html).toContain(
      'href="https://app.openstatus.dev/invite?token=tok"',
    );
  });

  test("page subscription uses the page brand and logo", async () => {
    const html = await render(
      <PageSubscriptionEmail
        page="Acme"
        link="https://acme.openstatus.dev/verify/t"
        img={{
          src: "https://acme.dev/logo.png",
          alt: "",
          href: "https://acme.dev",
        }}
      />,
    );
    expect(html).toContain("Acme Status");
    expect(html).toContain("https://acme.dev/logo.png");
    expect(html).toContain('href="https://acme.openstatus.dev/verify/t"');
    expect(html).not.toContain("every status report");
  });

  test("one-time links appear once, on the CTA only", async () => {
    const link = "https://acme.openstatus.dev/verify/t";
    for (const el of [
      <PageSubscriptionEmail key="s" page="Acme" link={link} />,
      <StatusPageMagicLinkEmail key="m" page="Acme" link={link} />,
    ]) {
      const html = await render(el);
      expect(html.split(`href="${link}"`).length - 1).toBe(1);
      expect(html).toContain('href="https://acme.openstatus.dev"');
    }
  });

  test("team invitation falls back on an empty workspace name", async () => {
    const html = await render(
      <TeamInvitationEmail token="t" workspaceName="" invitedBy="a@b.c" />,
    );
    expect(html).toContain("Join openstatus");
    expect(html).not.toContain("on openstatus");
    expect(html).not.toContain("Workspace");
  });

  test("magic link", async () => {
    const html = await render(
      <StatusPageMagicLinkEmail
        page="Acme"
        link="https://acme.openstatus.dev/verify/t"
      />,
    );
    expect(html).toContain("Sign in to Acme");
    expect(html).toContain("24 hours");
    expect(html).toContain('href="https://acme.openstatus.dev/verify/t"');
  });
});

describe("every transactional template", () => {
  const all = {
    alert: <MonitorAlertEmail {...alert} />,
    degraded: <MonitorAlertEmail {...alert} type="degraded" />,
    recovery: <MonitorAlertEmail {...alert} type="recovery" />,
    privateLocation: (
      <PrivateLocationAlertEmail
        locationName="a"
        status="error"
        lastSeenAt="2026-07-23T10:00:00Z"
      />
    ),
    statusReport: <StatusReportEmail {...report} />,
    deactivation: (
      <MonitorDeactivationEmail deactivateAt={new Date("2026-09-25")} />
    ),
    paused: <MonitorPausedEmail />,
    invitation: <TeamInvitationEmail token="t" invitedBy="a@b.c" />,
    subscription: <PageSubscriptionEmail page="Acme" link="https://a.dev" />,
    magicLink: <StatusPageMagicLinkEmail page="Acme" link="https://a.dev" />,
  };

  for (const [name, element] of Object.entries(all)) {
    test(`${name}: brand casing, no SVG data URIs, no flex/grid, 600px`, async () => {
      const html = await render(element);
      expect(html).not.toContain("OpenStatus<");
      expect(html).not.toMatch(/>[^<]*OpenStatus[^<]*</);
      expect(html).not.toContain("data:image/svg");
      expect(html).not.toMatch(/display:\s?(-webkit-)?(inline-)?(flex|grid)/);
      expect(html).toContain("max-width:600px");
      expect(html).toContain(POSTAL_ADDRESS);
    });
  }
});
