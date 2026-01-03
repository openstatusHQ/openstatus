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

export interface StatusPageMagicLinkProps {
  page: string;
  link: string;
}

const StatusPageMagicLinkEmail = ({ page, link }: StatusPageMagicLinkProps) => {
  return (
    <Html>
      <Head>
        <title>Authenticate to "{page}" Status Page</title>
      </Head>
      <Preview>Authenticate to "{page}" Status Page</Preview>
      <Body>
        <Layout>
          <Heading as="h3">Access to "{page}" Status Page</Heading>
          <Text>
            You are receiving this email because you have requested access to
            the "{page}" Status Page.
          </Text>
          <Text>
            To authenticate, please click the link below. The link is valid for
            24 hours. If you believe this is a mistake, please ignore this
            email.
          </Text>
          <Text>
            <Link style={styles.link} href={link}>
              Authenticate
            </Link>
          </Text>
        </Layout>
      </Body>
    </Html>
  );
};

StatusPageMagicLinkEmail.PreviewProps = {
  page: "OpenStatus",
  link: "https://slug.openstatus.dev/verify/token-xyz",
} satisfies StatusPageMagicLinkProps;

export default StatusPageMagicLinkEmail;
