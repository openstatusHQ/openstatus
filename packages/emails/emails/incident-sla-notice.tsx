/** @jsxRuntime automatic @jsxImportSource react */

import { Text } from "react-email";

import { Actions } from "./_components/actions";
import { Footer } from "./_components/footer";
import { Heading } from "./_components/heading";
import { KeyValue } from "./_components/key-value";
import { Layout } from "./_components/layout";
import { styles } from "./_components/styles";

export interface IncidentSlaNoticeProps {
  notice: "warning" | "miss";
  /** Wording from the services' `incidentSlaNoticeCopy`, shared with Slack. */
  headline: string;
  body: string;
  action: string | null;
  incidentTitle: string;
  severity: "critical" | "major" | "minor";
  workspaceName: string;
  /** "1h", "1d" */
  target: string;
  due: string;
  /** `workspace`: nobody is assigned, so owners and admins get it. */
  audience: "incident" | "workspace";
  url: string;
}

export function incidentSlaNoticeSubject(
  props: Pick<IncidentSlaNoticeProps, "headline" | "incidentTitle">,
): string {
  return `${props.headline}: ${props.incidentTitle}`;
}

const reason = {
  incident:
    "You get this because you lead or declared this incident and Slack could not deliver this notice.",
  workspace:
    "You get this because you own or administer this workspace, nobody is assigned to this incident, and Slack could not deliver this notice.",
} as const;

const IncidentSlaNoticeEmail = (props: IncidentSlaNoticeProps) => {
  return (
    <Layout
      preview={props.body}
      pill={{
        tone: props.notice === "warning" ? "warning" : "danger",
        label: props.headline,
      }}
      footer={<Footer reason={reason[props.audience]} />}
    >
      <Heading title={incidentSlaNoticeSubject(props)}>{props.body}</Heading>
      {props.action ? <Text style={styles.text}>{props.action}</Text> : null}
      <KeyValue
        rows={[
          { label: "Incident", value: props.incidentTitle },
          { label: "Severity", value: props.severity },
          { label: "Target", value: props.target, mono: true },
          {
            label: "Due",
            value: props.due,
            tone: props.notice === "miss" ? "danger" : undefined,
          },
          { label: "Workspace", value: props.workspaceName },
        ]}
      />
      <Actions primary={{ label: "Open incident", href: props.url }} />
    </Layout>
  );
};

IncidentSlaNoticeEmail.PreviewProps = {
  notice: "warning",
  headline: "Response due soon",
  body: "Checkout is failing (critical) has a 1h response target due Nov 11, 2026, 8:50 PM UTC.",
  action: "Acknowledge it before then.",
  incidentTitle: "Checkout is failing",
  severity: "critical",
  workspaceName: "Acme",
  target: "1h",
  due: "Nov 11, 2026, 8:50 PM UTC",
  audience: "incident",
  url: "https://app.openstatus.dev/incidents/1",
} satisfies IncidentSlaNoticeProps;

export default IncidentSlaNoticeEmail;
