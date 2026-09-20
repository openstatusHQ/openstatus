/** @jsxRuntime automatic @jsxImportSource react */

import { z } from "zod";

import { Actions } from "./_components/actions";
import { Footer } from "./_components/footer";
import { Heading } from "./_components/heading";
import { KeyValue } from "./_components/key-value";
import { Layout } from "./_components/layout";

const BASE_URL = "https://app.openstatus.dev/invite";

export const TeamInvitationSchema = z.object({
  invitedBy: z.string(),
  workspaceName: z.string().optional().nullable(),
  token: z.string(),
  baseUrl: z.string().optional(),
});

export type TeamInvitationProps = z.infer<typeof TeamInvitationSchema>;

const TeamInvitationEmail = ({
  token,
  workspaceName,
  invitedBy,
  baseUrl = BASE_URL,
}: TeamInvitationProps) => {
  return (
    <Layout
      preview={`${invitedBy} invited you. The link is valid for 7 days.`}
      pill={{ tone: "neutral", label: "Invitation" }}
      footer={
        <Footer reason="You get this because a workspace member invited this address. If that is a mistake, ignore this email." />
      }
    >
      <Heading
        title={
          workspaceName
            ? `Join ${workspaceName} on openstatus`
            : "Join openstatus"
        }
      >
        {invitedBy} invited you to their workspace. If you don’t have an account
        yet, accepting creates one.
      </Heading>
      <KeyValue
        rows={[
          ...(workspaceName
            ? [{ label: "Workspace", value: workspaceName }]
            : []),
          { label: "Invited by", value: invitedBy },
          { label: "Expires", value: "In 7 days" },
        ]}
      />
      <Actions
        primary={{
          label: "Accept invitation",
          href: `${baseUrl}?token=${token}`,
        }}
      />
    </Layout>
  );
};

TeamInvitationEmail.PreviewProps = {
  token: "token",
  workspaceName: "acme",
  invitedBy: "max@openstatus.dev",
} satisfies TeamInvitationProps;

export default TeamInvitationEmail;
