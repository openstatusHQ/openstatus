/** @jsxRuntime automatic @jsxImportSource react */

import { Actions } from "./_components/actions";
import { Callout } from "./_components/callout";
import { Footer } from "./_components/footer";
import { Heading, Mono } from "./_components/heading";
import { KeyValue } from "./_components/key-value";
import { Layout } from "./_components/layout";
import { type PlanLoss, planLossRows } from "./_components/plan-loss";
import { Signature } from "./_components/signature";

export type PlanDowngradedReason =
  | "subscription_deleted"
  | "trial_ended"
  | "trial_cancelled";

export interface PlanDowngradedProps {
  workspaceSlug: string;
  /** Plan the workspace was on, e.g. "team". */
  previousPlan: string;
  loss: PlanLoss;
  /** Defaults to `subscription_deleted`. */
  reason?: PlanDowngradedReason;
}

function isTrial(props: PlanDowngradedProps) {
  return props.reason === "trial_ended" || props.reason === "trial_cancelled";
}

export const BILLING_URL = "https://app.openstatus.dev/settings/billing";
export const BILLING_FOOTER_REASON =
  "Sent to workspace owners and the billing contact.";

export function planDowngradedSubject(props: PlanDowngradedProps): string {
  const pages = props.loss.pagesDeleted.length;
  const lead = isTrial(props)
    ? "Your trial ended"
    : "Your workspace is on the free plan";
  return pages > 0
    ? `${lead} — ${pages} status page${pages === 1 ? "" : "s"} deleted`
    : `${lead} — here is what changed`;
}

const PlanDowngradedEmail = (props: PlanDowngradedProps) => {
  const { loss } = props;
  const rows = planLossRows(loss, true);
  const trial = isTrial(props);
  const verb = trial ? "upgrading" : "re-subscribing";
  const intro =
    props.reason === "trial_ended"
      ? `Your ${props.previousPlan} trial ended without a payment method`
      : props.reason === "trial_cancelled"
        ? `You cancelled your ${props.previousPlan} trial`
        : `Your ${props.previousPlan} subscription ended`;
  return (
    <Layout
      preview={`What was removed, what survived, and how to ${
        trial ? "upgrade" : "re-subscribe"
      }.`}
      pill={{ tone: "neutral", label: trial ? "Trial" : "Account change" }}
      footer={<Footer reason={BILLING_FOOTER_REASON} />}
    >
      <Heading
        title={
          <>
            <Mono>{props.workspaceSlug}</Mono> is back on the free plan
          </>
        }
      >
        {intro}, so the workspace was trimmed to what the free plan holds.
      </Heading>
      {loss.pagesDeleted.length > 0 ? (
        <Callout title="Deleted status pages cannot be restored">
          Everything else is reversible: paused monitors keep their history and
          resume when you switch them back on, and {verb} lets you invite your
          team again.
        </Callout>
      ) : (
        <Callout title="No status page was deleted">
          Paused monitors keep their history and resume when you switch them
          back on, and {verb} lets you invite your team again.
        </Callout>
      )}
      <KeyValue
        rows={[
          {
            label: "Plan",
            value: `${props.previousPlan}${trial ? " trial" : ""} → free`,
          },
          ...rows,
        ]}
      />
      <Actions
        primary={{
          label: trial ? "Upgrade" : "Re-subscribe",
          href: BILLING_URL,
        }}
        secondary={{
          label: "Compare plans",
          href: "https://www.openstatus.dev/pricing",
        }}
      />
      <Signature />
    </Layout>
  );
};

PlanDowngradedEmail.PreviewProps = {
  workspaceSlug: "acme-dev",
  previousPlan: "team",
  loss: {
    monitorsDeactivated: 11,
    pagesDeleted: ["Acme API", "Acme EU"],
    keptPageTitle: "Acme",
    notificationsDeleted: 3,
    invitationsDeleted: 1,
    membersRemoved: 4,
    customDomains: ["status.acme.dev"],
    sso: true,
  },
} satisfies PlanDowngradedProps;

export default PlanDowngradedEmail;
