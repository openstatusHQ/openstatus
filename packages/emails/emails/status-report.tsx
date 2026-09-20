/** @jsxRuntime automatic @jsxImportSource react */

import { z } from "zod";

import { Actions } from "./_components/actions";
import { Eyebrow } from "./_components/eyebrow";
import { Footer } from "./_components/footer";
import { formatDateTime, formatElapsed } from "./_components/format";
import { Heading } from "./_components/heading";
import { KeyValue } from "./_components/key-value";
import { Layout, statusPageBrand } from "./_components/layout";
import { Markdown } from "./_components/markdown";
import type { Tone } from "./_components/styles";

export const StatusReportSchema = z.object({
  pageTitle: z.string(),
  // statusReportStatus from db
  status: z.enum([
    "investigating",
    "identified",
    "monitoring",
    "resolved",
    "maintenance",
  ]),
  date: z.string(),
  message: z.string(),
  reportTitle: z.string(),
  pageComponents: z.array(z.string()),
  // pageComponentImpact from db; absent for maintenance and legacy reports
  componentImpacts: z
    .array(
      z.object({
        name: z.string(),
        impact: z.enum([
          "operational",
          "degraded_performance",
          "partial_outage",
          "major_outage",
        ]),
      }),
    )
    .optional(),
  unsubscribeUrl: z.url(),
  manageUrl: z.url(),
  statusPageUrl: z.url().optional(),
  /** 1-based position of this update within the report. */
  updateIndex: z.number().optional(),
  reportStartedAt: z.string().optional(),
});

export type StatusReportProps = z.infer<typeof StatusReportSchema>;

const statusTone = {
  investigating: "danger",
  identified: "warning",
  monitoring: "info",
  resolved: "success",
  maintenance: "info",
} satisfies Record<StatusReportProps["status"], Tone>;

type Impact = NonNullable<
  StatusReportProps["componentImpacts"]
>[number]["impact"];

const impactRow = {
  operational: { label: "Operational", tone: "success" },
  degraded_performance: { label: "Degraded performance", tone: "warning" },
  partial_outage: { label: "Partial outage", tone: "warning" },
  major_outage: { label: "Major outage", tone: "danger" },
} satisfies Record<Impact, { label: string; tone: Tone }>;

const componentLabel = {
  investigating: "Affected",
  identified: "Affected",
  monitoring: "Monitoring",
  resolved: "Resolved",
  maintenance: "Maintenance",
} satisfies Record<StatusReportProps["status"], string>;

function isDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export function statusReportPreheader(
  props: Pick<StatusReportProps, "status" | "pageTitle" | "pageComponents">,
): string {
  const components =
    props.pageComponents.length > 0
      ? props.pageComponents.slice(0, 3).join(", ")
      : props.pageTitle;
  if (props.status === "resolved") return `Resolved for ${components}.`;
  if (props.status === "maintenance") return `Planned work on ${components}.`;
  return `${componentLabel[props.status]}: ${components}.`;
}

function StatusReportEmail({
  status,
  date,
  message,
  reportTitle,
  pageTitle,
  pageComponents,
  componentImpacts,
  unsubscribeUrl,
  manageUrl,
  statusPageUrl,
  updateIndex,
  reportStartedAt,
}: StatusReportProps) {
  const tone = statusTone[status];
  const dated = isDate(date);
  const elapsed =
    dated && reportStartedAt && isDate(reportStartedAt)
      ? formatElapsed(reportStartedAt, date)
      : undefined;

  const links = [];
  if (unsubscribeUrl)
    links.push({ label: "Unsubscribe", href: unsubscribeUrl });
  if (manageUrl) links.push({ label: "Manage notifications", href: manageUrl });

  return (
    <Layout
      preview={statusReportPreheader({ status, pageTitle, pageComponents })}
      brand={statusPageBrand(pageTitle, statusPageUrl ?? manageUrl)}
      pill={{ tone, label: status }}
      footer={
        <Footer
          reason={`You get this because you subscribed to updates from ${pageTitle}.`}
          links={links}
        />
      }
    >
      <Eyebrow
        items={[
          updateIndex ? `Update ${updateIndex}` : undefined,
          dated ? formatDateTime(date) : undefined,
          elapsed && elapsed !== "0m" ? `${elapsed} in` : undefined,
        ]}
      />
      <Heading title={reportTitle} />
      {!dated ? <KeyValue rows={[{ label: "Window", value: date }]} /> : null}
      {pageComponents.length > 0 ? (
        <KeyValue
          rows={pageComponents.map((name) => {
            const impact = componentImpacts?.find((c) => c.name === name);
            return {
              label: name,
              value: impact ? impactRow[impact.impact].label : null,
              tone: impact ? impactRow[impact.impact].tone : undefined,
            };
          })}
        />
      ) : null}
      <Markdown>{message}</Markdown>
      {statusPageUrl ? (
        <Actions
          primary={{ label: "Follow on the status page", href: statusPageUrl }}
        />
      ) : null}
    </Layout>
  );
}

StatusReportEmail.PreviewProps = {
  pageTitle: "openstatus",
  reportTitle: "API unavailable — service partially restored",
  status: "monitoring",
  date: "2026-09-18T12:37:00Z",
  reportStartedAt: "2026-09-18T10:23:00Z",
  updateIndex: 3,
  message: `Queued workflows have drained and jobs are running normally again. One piece is still broken: publishing our GitHub Action returns 500s upstream, so new versions can't go live.

### What we're doing

- Working with GitHub Support on the Marketplace 500s.
- Retrying the publish job every 15 minutes.

### What you need to do

Nothing. Pin the previous action version if your pipeline is blocked — next update by **14:00 UTC**.
  `,
  pageComponents: ["openstatus API", "GitHub Runners", "Cache Action"],
  componentImpacts: [
    { name: "openstatus API", impact: "operational" },
    { name: "GitHub Runners", impact: "degraded_performance" },
    { name: "Cache Action", impact: "partial_outage" },
  ],
  statusPageUrl: "https://status.openstatus.dev",
  unsubscribeUrl:
    "https://status.openstatus.dev/unsubscribe/550e8400-e29b-41d4-a716-446655440000",
  manageUrl:
    "https://status.openstatus.dev/manage/550e8400-e29b-41d4-a716-446655440000",
} satisfies StatusReportProps;

export default StatusReportEmail;
