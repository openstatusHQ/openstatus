/** @jsxImportSource react */

import {
  Body,
  Column,
  Head,
  Heading,
  Html,
  Link,
  Markdown,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { z } from "zod";
import { Layout } from "./_components/layout";
import { colors, styles } from "./_components/styles";

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
  monitors: z.array(z.string()),
  unsubscribeUrl: z.string().url().optional(),
});

export type StatusReportProps = z.infer<typeof StatusReportSchema>;

function getStatusColor(status: string) {
  switch (status) {
    case "investigating":
      return colors.danger;
    case "identified":
      return colors.warning;
    case "resolved":
      return colors.success;
    case "monitoring":
      return colors.info;
    case "maintenance":
      return colors.info;
    default:
      return colors.success;
  }
}

function StatusReportEmail({
  status,
  date,
  message,
  reportTitle,
  pageTitle,
  monitors,
  unsubscribeUrl,
}: StatusReportProps) {
  return (
    <Html>
      <Head />
      <Preview>There are new updates on "{pageTitle}" page</Preview>
      <Body style={styles.main}>
        <Layout>
          <Row>
            <Column>
              <Heading as="h3">{pageTitle}</Heading>
            </Column>
            <Column style={{ textAlign: "right" }}>
              <Text
                style={{
                  color: getStatusColor(status),
                  textTransform: "uppercase",
                }}
              >
                {status}
              </Text>
            </Column>
          </Row>
          <Row style={styles.row}>
            <Column>
              <Text style={styles.bold}>Title</Text>
            </Column>
            <Column style={{ textAlign: "right" }}>
              <Text>{reportTitle}</Text>
            </Column>
          </Row>
          <Row style={styles.row}>
            <Column>
              <Text style={styles.bold}>Date</Text>
            </Column>
            <Column style={{ textAlign: "right" }}>
              <Text>{date}</Text>
            </Column>
          </Row>
          <Row style={styles.row}>
            <Column>
              <Text style={styles.bold}>Affected</Text>
            </Column>
            <Column style={{ textAlign: "right" }}>
              <Text style={{ flexWrap: "wrap", wordWrap: "break-word" }}>
                {monitors.length > 0 ? monitors.join(", ") : "N/A"}
              </Text>
            </Column>
          </Row>
          <Row style={styles.row}>
            <Column>
              <Markdown>{message}</Markdown>
            </Column>
          </Row>
          {unsubscribeUrl && (
            <Section style={{ marginTop: "24px", textAlign: "center" }}>
              <Text style={{ fontSize: "12px", color: "#6b7280" }}>
                <Link
                  href={unsubscribeUrl}
                  style={{ color: "#6b7280", textDecoration: "underline" }}
                >
                  Unsubscribe
                </Link>{" "}
                from these notifications.
              </Text>
            </Section>
          )}
        </Layout>
      </Body>
    </Html>
  );
}

StatusReportEmail.PreviewProps = {
  pageTitle: "OpenStatus Status",
  reportTitle: "API Unavaible",
  status: "investigating",
  date: new Date().toISOString(),
  message: `
**Status**: Partial Service Restored

**GitHub Runners**: Operational

**Cache Action**: Degraded

---

### What's Changed

- All queued workflows are now being picked up and completed successfully.
- Jobs are running normally on our GitHub App. ### Current Issue: Cache Action Unavailable Attempts to re-publish our action to GitHub Marketplace are returning 500 Internal Server Errors. This prevents the updated versions from going live.

### Mitigation In Progress

- Collaborating with GitHub Support to resolve any upstream issues.

### Next Update

We'll post another update by **19:00 UTC** today or sooner if critical developments occur. We apologize for the inconvenience and appreciate your patience as we restore full cache functionality.
  `,
  monitors: ["OpenStatus API", "OpenStatus Webhook"],
  unsubscribeUrl:
    "https://status.openstatus.dev/unsubscribe/550e8400-e29b-41d4-a716-446655440000",
};

export default StatusReportEmail;
