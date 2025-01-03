/** @jsxImportSource react */

import {
  Body,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import { Layout } from "./_components/layout";
import { styles } from "./_components/styles";

export interface TeamInvitationProps {
  invitedBy: string; // email address
  workspaceName?: string;
  token: string;
}

const TeamInvitationEmail = ({
  token,
  workspaceName,
  invitedBy,
}: TeamInvitationProps) => {
  return (
    <Html>
      <Head />
      <Preview>You have been invited to join OpenStatus.dev</Preview>
      <Body style={styles.main}>
        <Layout>
          <Heading as="h3">
            You have been invited to join{" "}
            {`"${workspaceName}" workspace` || "OpenStatus.dev"} by {invitedBy}
          </Heading>
          <Text>
            Click here to access the workspace:{" "}
            <Link
              style={styles.link}
              href={`https://openstatus.dev/app/invite?token=${token}`}
            >
              accept invitation
            </Link>
          </Text>
          <Text>
            If you don't have an account yet, it will require you to create one.
          </Text>
        </Layout>
      </Body>
    </Html>
  );
};

TeamInvitationEmail.PreviewProps = {
  token: "token",
  workspaceName: "OpenStatus",
  invitedBy: "max@openstatus.dev",
} satisfies TeamInvitationProps;

export { TeamInvitationEmail };
export default TeamInvitationEmail;
