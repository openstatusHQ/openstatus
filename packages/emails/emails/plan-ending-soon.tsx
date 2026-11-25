/** @jsxRuntime automatic @jsxImportSource react */

import { Actions } from "./_components/actions";
import { Callout } from "./_components/callout";
import { Footer } from "./_components/footer";
import { formatDay, formatLongDay, formatShortDay } from "./_components/format";
import { Heading } from "./_components/heading";
import { KeyValue } from "./_components/key-value";
import { Layout } from "./_components/layout";
import { type PlanLoss, planLossRows } from "./_components/plan-loss";
import { Signature } from "./_components/signature";
import { BILLING_FOOTER_REASON, BILLING_URL } from "./plan-downgraded";

export interface PlanEndingSoonProps {
  workspaceSlug: string;
  plan: string;
  endsAt: Date;
  /** Counted when the cancellation was scheduled. */
  loss: PlanLoss;
}

export function planEndingSoonSubject(props: PlanEndingSoonProps): string {
  return `Your ${props.plan} plan ends on ${formatShortDay(props.endsAt)} — resume to keep everything`;
}

const PlanEndingSoonEmail = (props: PlanEndingSoonProps) => {
  const rows = planLossRows(props.loss, false);
  return (
    <Layout
      preview="What the workspace loses when it moves to the free plan."
      pill={{ tone: "neutral", label: "Action needed" }}
      footer={<Footer reason={BILLING_FOOTER_REASON} />}
    >
      <Heading
        title={`Your ${props.plan} plan ends on ${formatLongDay(props.endsAt)}`}
      >
        The subscription is set to cancel. On that day the workspace moves to
        the free plan and is trimmed to what it holds.
      </Heading>
      <Callout title="Resuming keeps everything">
        Nothing changes until the plan ends. Resume the subscription before then
        and nothing below happens.
      </Callout>
      <KeyValue
        rows={[
          { label: "Workspace", value: props.workspaceSlug, mono: true },
          { label: "Plan ends", value: formatDay(props.endsAt), bold: true },
          ...rows,
        ]}
      />
      <Actions primary={{ label: "Resume subscription", href: BILLING_URL }} />
      <Signature />
    </Layout>
  );
};

PlanEndingSoonEmail.PreviewProps = {
  workspaceSlug: "acme-dev",
  plan: "team",
  endsAt: new Date("2026-09-25T00:00:00Z"),
  loss: {
    monitorsDeactivated: 11,
    pagesDeleted: ["Acme API"],
    keptPageTitle: "Acme",
    notificationsDeleted: 3,
    invitationsDeleted: 0,
    membersRemoved: 4,
    customDomains: [],
    sso: false,
  },
} satisfies PlanEndingSoonProps;

export default PlanEndingSoonEmail;
