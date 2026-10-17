/** @jsxRuntime automatic @jsxImportSource react */

import { Footer } from "./_components/footer";
import { Heading } from "./_components/heading";
import { KeyValue } from "./_components/key-value";
import { Layout } from "./_components/layout";

export interface OwnershipTransferredProps {
  workspaceName: string;
  /** Email of the new owner. */
  newOwner: string;
  /** Email of the former owner. */
  formerOwner: string;
  recipient: "new" | "former";
}

export function ownershipTransferredSubject(
  props: OwnershipTransferredProps,
): string {
  return props.recipient === "new"
    ? `You are now the owner of ${props.workspaceName} on openstatus`
    : `You transferred ownership of ${props.workspaceName} on openstatus`;
}

const OwnershipTransferredEmail = (props: OwnershipTransferredProps) => {
  const isNew = props.recipient === "new";
  return (
    <Layout
      preview={
        isNew
          ? `${props.formerOwner} made you the owner of ${props.workspaceName}.`
          : `${props.newOwner} is now the owner of ${props.workspaceName}.`
      }
      pill={{ tone: "neutral", label: "Account change" }}
      footer={
        <Footer
          reason={
            isNew
              ? "You get this because you were made the owner of this workspace."
              : "You get this because you were the owner of this workspace."
          }
        />
      }
    >
      {isNew ? (
        <Heading title={`You are now the owner of ${props.workspaceName}`}>
          You can manage members, SSO and billing for this workspace. Billing
          emails for it now go to you.
        </Heading>
      ) : (
        <Heading title={`You transferred ownership of ${props.workspaceName}`}>
          {`${props.newOwner} is now the owner and you are a member. If you did not do this, reply to this email.`}
        </Heading>
      )}
      <KeyValue
        rows={
          isNew
            ? [{ label: "Transferred by", value: props.formerOwner }]
            : [{ label: "New owner", value: props.newOwner }]
        }
      />
    </Layout>
  );
};

OwnershipTransferredEmail.PreviewProps = {
  workspaceName: "Acme",
  newOwner: "web@acme.dev",
  formerOwner: "max@acme.dev",
  recipient: "new",
} satisfies OwnershipTransferredProps;

export default OwnershipTransferredEmail;
