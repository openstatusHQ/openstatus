/** @jsxImportSource react */

import {
  Body,
  Column,
  Head,
  Heading,
  Html,
  Markdown,
  Preview,
  Row,
  Text,
} from "@react-email/components";
import { z } from "zod";
import { Layout } from "./_components/layout";
import { colors, severityColors, styles } from "./_components/styles";

export const StatusReportSchema = z.object({
  pageTitle: z.string(),
  status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
  severity: z
    .enum(["critical", "high", "moderate", "low", "informational"])
    .nullable()
    .optional(),
  date: z.string(),
  message: z.string(),
  reportTitle: z.string(),
  monitors: z.array(z.string()),
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
    default:
      return colors.success;
  }
}

function StatusReportEmail({
  status,
  date,
  severity,
  message,
  reportTitle,
  pageTitle,
  monitors,
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
          {severity ? (
            <Row style={styles.row}>
              <Column>
                <Text style={styles.bold}>Severity</Text>
              </Column>
              <Column style={{ textAlign: "right" }}>
                <Text
                  style={{
                    color: severityColors[severity],
                    textTransform: "uppercase",
                  }}
                >
                  {severity}
                </Text>
              </Column>
            </Row>
          ) : null}
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
        </Layout>
      </Body>
    </Html>
  );
}

// TODO: add unsubscribe link!

StatusReportEmail.PreviewProps = {
  pageTitle: "OpenStatus Status",
  reportTitle: "API Unavaible",
  status: "investigating",
  severity: "major",
  date: new Date().toISOString(),
  message:
    "The API is down, **including the webhook**. We are actively investigating the issue and will provide updates as soon as possible.",
  monitors: ["OpenStatus API", "OpenStatus Webhook"],
};

export default StatusReportEmail;
