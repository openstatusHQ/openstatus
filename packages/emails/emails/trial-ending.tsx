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

export interface TrialEndingProps {
  workspaceSlug: string;
  plan: string;
  trialEnd: Date;
  hasPaymentMethod: boolean;
  /** What the free plan would trim; only rendered without a card on file. */
  loss?: PlanLoss;
}

export function trialEndingSubject(props: TrialEndingProps): string {
  const day = formatShortDay(props.trialEnd);
  return props.hasPaymentMethod
    ? `Your trial ends on ${day} — your ${props.plan} plan continues`
    : `Your trial ends on ${day} — add a payment method to keep ${props.plan}`;
}

const TrialEndingEmail = (props: TrialEndingProps) => {
  const title = `Your trial ends on ${formatLongDay(props.trialEnd)}`;
  const base = [
    { label: "Workspace", value: props.workspaceSlug, mono: true },
    { label: "Trial ends", value: formatDay(props.trialEnd), bold: true },
  ];

  if (props.hasPaymentMethod) {
    return (
      <Layout
        preview={`Your ${props.plan} plan continues, nothing to do.`}
        pill={{ tone: "neutral", label: "Trial" }}
        footer={<Footer reason={BILLING_FOOTER_REASON} />}
      >
        <Heading title={title}>
          You have a payment method on file, so the {props.plan} plan continues
          without interruption. The first invoice is charged on that day.
        </Heading>
        <Callout tone="success" title="Nothing to do">
          Monitors, status pages and members stay exactly as they are. If you
          would rather not continue, cancel before the trial ends.
        </Callout>
        <KeyValue
          rows={[...base, { label: "Plan", value: `${props.plan}, continues` }]}
        />
        <Actions
          primary={{ label: "Manage subscription", href: BILLING_URL }}
        />
        <Signature />
      </Layout>
    );
  }

  const rows = props.loss ? planLossRows(props.loss, false) : [];
  const consequence = `Without one, the workspace moves to the free plan on that day${
    rows.length > 0 ? " and is trimmed to what it holds." : "."
  }`;
  return (
    <Layout
      preview={`Add a payment method to keep ${props.plan}.`}
      pill={{ tone: "neutral", label: "Action needed" }}
      footer={<Footer reason={BILLING_FOOTER_REASON} />}
    >
      <Heading title={title}>
        There is no payment method on file. {consequence}
      </Heading>
      <Callout title="Adding a card keeps everything">
        Nothing changes until the trial ends. Add a payment method before then
        and the {props.plan} plan simply continues.
      </Callout>
      <KeyValue
        rows={[
          ...base,
          { label: "Plan", value: `${props.plan} → free` },
          ...rows,
        ]}
      />
      <Actions primary={{ label: "Add payment method", href: BILLING_URL }} />
      <Signature />
    </Layout>
  );
};

TrialEndingEmail.PreviewProps = {
  workspaceSlug: "acme-dev",
  plan: "starter",
  trialEnd: new Date("2026-09-25T00:00:00Z"),
  hasPaymentMethod: false,
  loss: {
    monitorsDeactivated: 4,
    pagesDeleted: ["Acme API"],
    keptPageTitle: "Acme",
    notificationsDeleted: 0,
    invitationsDeleted: 0,
    membersRemoved: 2,
    customDomains: [],
    sso: false,
  },
} satisfies TrialEndingProps;

export default TrialEndingEmail;
