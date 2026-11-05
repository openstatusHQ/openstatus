/** @jsxRuntime automatic @jsxImportSource react */

import { Actions } from "./_components/actions";
import { Footer } from "./_components/footer";
import { Heading } from "./_components/heading";
import { KeyValue } from "./_components/key-value";
import { Layout } from "./_components/layout";

export interface IncidentCommanderProps {
  incidentTitle: string;
  severity: "critical" | "major" | "minor";
  workspaceName: string;
  assignedBy: string;
  url: string;
}

export function incidentCommanderSubject(
  props: IncidentCommanderProps,
): string {
  return `You are commander of ${props.incidentTitle}`;
}

const tone = {
  critical: "danger",
  major: "warning",
  minor: "info",
} as const;

const IncidentCommanderEmail = (props: IncidentCommanderProps) => {
  return (
    <Layout
      preview={`${props.assignedBy} made you commander of a ${props.severity} incident.`}
      pill={{ tone: tone[props.severity], label: `${props.severity} incident` }}
      footer={
        <Footer reason="You get this because you were made commander of an incident in this workspace." />
      }
    >
      <Heading title={`You are commander of ${props.incidentTitle}`}>
        {`${props.assignedBy} made you the commander of this incident in ${props.workspaceName}. You lead the response: keep the timeline current, decide when it is resolved, and close it with a postmortem.`}
      </Heading>
      <KeyValue
        rows={[
          { label: "Incident", value: props.incidentTitle },
          { label: "Severity", value: props.severity },
          { label: "Workspace", value: props.workspaceName },
        ]}
      />
      <Actions primary={{ label: "Open incident", href: props.url }} />
    </Layout>
  );
};

IncidentCommanderEmail.PreviewProps = {
  incidentTitle: "Checkout is failing",
  severity: "critical",
  workspaceName: "Acme",
  assignedBy: "Max",
  url: "https://app.openstatus.dev/incidents/1",
} satisfies IncidentCommanderProps;

export default IncidentCommanderEmail;
