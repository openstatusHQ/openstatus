/** @jsxRuntime automatic @jsxImportSource react */

import { Footer } from "./_components/footer";
import { Heading } from "./_components/heading";
import { KeyValue } from "./_components/key-value";
import { Layout } from "./_components/layout";

export interface MemberRemovedProps {
  workspaceName: string;
  reason: "downgrade" | "manual";
  /** Who to ask for access again. */
  owners: string[];
}

export function memberRemovedSubject(props: MemberRemovedProps): string {
  return `You no longer have access to ${props.workspaceName} on openstatus`;
}

const MemberRemovedEmail = (props: MemberRemovedProps) => {
  return (
    <Layout
      preview={
        props.owners.length > 0
          ? `Ask ${props.owners[0]} if you need access again.`
          : "Ask a workspace owner if you need access again."
      }
      pill={{ tone: "neutral", label: "Account change" }}
      footer={
        <Footer reason="You get this because you were a member of this workspace." />
      }
    >
      <Heading title={`You were removed from ${props.workspaceName}`}>
        {props.reason === "downgrade"
          ? "The workspace’s subscription ended and the free plan holds a single member, so every other member was removed. Your openstatus account and your other workspaces are unchanged."
          : "A workspace owner removed you. Your openstatus account and your other workspaces are unchanged."}
      </Heading>
      {props.owners.length > 0 ? (
        <KeyValue
          rows={[
            {
              label: "Ask for access",
              value: props.owners.join(", "),
            },
          ]}
        />
      ) : null}
    </Layout>
  );
};

MemberRemovedEmail.PreviewProps = {
  workspaceName: "Acme",
  reason: "downgrade",
  owners: ["max@acme.dev"],
} satisfies MemberRemovedProps;

export default MemberRemovedEmail;
