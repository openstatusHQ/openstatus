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
import { z } from "zod";
import { Layout } from "./_components/layout";
import { styles } from "./_components/styles";

export const PageSubscriptionSchema = z.object({
  page: z.string(),
  link: z.string(),
  img: z
    .object({
      src: z.string(),
      alt: z.string(),
      href: z.string(),
    })
    .optional(),
});

export type PageSubscriptionProps = z.infer<typeof PageSubscriptionSchema>;

const PageSubscriptionEmail = ({ page, link, img }: PageSubscriptionProps) => {
  return (
    <Html>
      <Head />
      <Preview>Confirm your subscription to "{page}" Status Page</Preview>
      <Body style={styles.main}>
        <Layout img={img}>
          <Heading as="h3">
            Confirm your subscription to "{page}" Status Page
          </Heading>
          <Text>
            You are receiving this email because you subscribed to receive
            updates from "{page}" Status Page.
          </Text>
          <Text>
            To confirm your subscription, please click the link below. The link
            is valid for 7 days. If you believe this is a mistake, please ignore
            this email.
          </Text>
          <Text>
            <Link style={styles.link} href={link}>
              Confirm subscription
            </Link>
          </Text>
        </Layout>
      </Body>
    </Html>
  );
};

PageSubscriptionEmail.PreviewProps = {
  link: "https://slug.openstatus.dev/verify/token",
  page: "OpenStatus",
} satisfies PageSubscriptionProps;

export default PageSubscriptionEmail;
