/** @jsxRuntime automatic @jsxImportSource react */

import { Footer } from "./_components/footer";
import { formatDay, formatLongDay, formatShortDay } from "./_components/format";
import { Heading } from "./_components/heading";
import { KeyValue } from "./_components/key-value";
import { Layout } from "./_components/layout";

export interface MemberAccessEndingProps {
  workspaceName: string;
  plan: string;
  endsAt: Date;
  reason: "cancellation" | "trial";
  /** Who can keep the plan, or ask for access again. */
  owners: string[];
}

export function memberAccessEndingSubject(
  props: MemberAccessEndingProps,
): string {
  return `Your access to ${props.workspaceName} on openstatus ends on ${formatShortDay(props.endsAt)}`;
}

const MemberAccessEndingEmail = (props: MemberAccessEndingProps) => {
  const ask =
    props.owners.length > 0
      ? `Ask ${props.owners[0]} to keep the plan if you still need access.`
      : "Ask a workspace owner to keep the plan if you still need access.";
  return (
    <Layout
      preview={ask}
      pill={{ tone: "neutral", label: "Heads up" }}
      footer={
        <Footer reason="You get this because you are a member of this workspace." />
      }
    >
      <Heading
        title={`You lose access to ${props.workspaceName} on ${formatLongDay(props.endsAt)}`}
      >
        {props.reason === "trial"
          ? `The workspace’s ${props.plan} trial ends without a payment method on file.`
          : `The workspace’s ${props.plan} subscription is cancelled and ends on that day.`}{" "}
        The free plan holds a single member, so every other member is removed
        unless an owner keeps the plan. Your openstatus account and your other
        workspaces are unchanged.
      </Heading>
      <KeyValue
        rows={[
          { label: "Access ends", value: formatDay(props.endsAt), bold: true },
          ...(props.owners.length > 0
            ? [{ label: "Ask to keep it", value: props.owners.join(", ") }]
            : []),
        ]}
      />
    </Layout>
  );
};

MemberAccessEndingEmail.PreviewProps = {
  workspaceName: "Acme",
  plan: "team",
  endsAt: new Date("2026-09-25T00:00:00Z"),
  reason: "cancellation",
  owners: ["max@acme.dev"],
} satisfies MemberAccessEndingProps;

export default MemberAccessEndingEmail;
