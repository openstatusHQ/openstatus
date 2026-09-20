/** @jsxRuntime automatic @jsxImportSource react */

import { Markdown } from "react-email";
import { z } from "zod";

import { Actions } from "./_components/actions";
import { Eyebrow } from "./_components/eyebrow";
import { Footer } from "./_components/footer";
import { formatDateTime, formatElapsed } from "./_components/format";
import { Heading } from "./_components/heading";
import { KeyValue } from "./_components/key-value";
import { Layout, statusPageBrand } from "./_components/layout";
import { colors, fonts, styles, type Tone } from "./_components/styles";

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
  monitoring: "warning",
  resolved: "success",
  maintenance: "neutral",
} satisfies Record<StatusReportProps["status"], Tone>;

const componentLabel = {
  investigating: "Affected",
  identified: "Affected",
  monitoring: "Monitoring",
  resolved: "Resolved",
  maintenance: "Maintenance",
} satisfies Record<StatusReportProps["status"], string>;

const heading = {
  margin: "20px 0 8px",
  padding: 0,
  fontFamily: fonts.mono,
  fontSize: "12px",
  lineHeight: "16px",
  fontWeight: 400,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: colors.faint,
} as const;

const markdownStyles = {
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  p: styles.text,
  li: { ...styles.text, margin: "0 0 6px" },
  ul: { margin: "0 0 16px", paddingLeft: "20px" },
  ol: { margin: "0 0 16px", paddingLeft: "20px" },
  link: styles.link,
  bold: { fontWeight: 600, color: colors.foreground },
  hr: { margin: "20px 0", borderColor: colors.border },
  codeInline: { ...styles.mono, backgroundColor: colors.subtle },
};

// Markdown passes raw HTML through to the email; subscribers must never
// receive author-controlled markup. Autolinks (<https://…>) stay intact.
function escapeHtml(markdown: string) {
  return markdown.replace(/<(?!https?:\/\/[^\s<>]+>)/g, "&lt;");
}

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
          rows={pageComponents.map((name) => ({
            label: name,
            value: componentLabel[status],
            tone,
            dot: true,
          }))}
        />
      ) : null}
      <Markdown
        markdownCustomStyles={markdownStyles}
        markdownContainerStyles={{ margin: "0 0 24px" }}
      >
        {escapeHtml(message)}
      </Markdown>
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
  statusPageUrl: "https://status.openstatus.dev",
  unsubscribeUrl:
    "https://status.openstatus.dev/unsubscribe/550e8400-e29b-41d4-a716-446655440000",
  manageUrl:
    "https://status.openstatus.dev/manage/550e8400-e29b-41d4-a716-446655440000",
} satisfies StatusReportProps;

export default StatusReportEmail;
