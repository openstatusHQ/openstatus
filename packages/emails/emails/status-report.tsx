/** @jsxImportSource react */

import {
  Body,
  Column,
  Head,
  Heading,
  Html,
  Preview,
  Row,
  Text,
} from "@react-email/components";
import { z } from "zod";
import { Layout } from "./_components/layout";
import { colors, styles } from "./_components/styles";

export const StatusReportSchema = z.object({
  pageTitle: z.string(),
  status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
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
          <Row style={styles.row}>
            <Column>
              <Text style={styles.bold}>Affected</Text>
            </Column>
            <Column style={{ textAlign: "right" }}>
              <Text style={{ flexWrap: "wrap", wordWrap: "break-word" }}>
                {monitors.join(", ")}
              </Text>
            </Column>
          </Row>
          <Row style={styles.row}>
            <Column>
              <Text>{message}</Text>
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
  date: "2021-07-19",
  message:
    "The API is down, including the webhook. We are actively investigating the issue and will provide updates as soon as possible.",
  monitors: ["OpenStatus API", "OpenStatus Webhook"],
};

export default StatusReportEmail;
