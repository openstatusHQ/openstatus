/** @jsxImportSource react */

import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { z } from "zod";
import { Layout } from "./_components/layout";
import { styles } from "./_components/styles";

export const MonitorDeactivationSchema = z.object({
  // lastLogin: z.coerce.date(),
  deactivateAt: z.coerce.date(),
});

export type MonitorDeactivationProps = z.infer<
  typeof MonitorDeactivationSchema
>;

const MonitorDeactivationEmail = ({
  // lastLogin,
  deactivateAt,
}: MonitorDeactivationProps) => {
  return (
    <Html>
      <Head />
      <Preview>
        Login to your OpenStatus account to keep your monitors active.
      </Preview>
      <Body style={styles.main}>
        <Layout>
          <Text>Hello 👋</Text>
          {/* <Heading as="h3">Deactivation of the your monitor(s)</Heading> */}
          <Text>
            To save on cloud resources and avoid having stale monitors. We are
            deactivating monitors for free account if you have not logged in for
            the last 2 months.
          </Text>
          {/* <Text>Your last login was {lastLogin.toDateString()}.</Text> */}
          <Text>
            Your monitor(s) will be deactivated on {deactivateAt.toDateString()}
            .
          </Text>
          <Text>
            If you would like to keep your monitor(s) active, please login to
            your account or upgrade to a paid plan.
          </Text>
          <Text style={{ textAlign: "center" }}>
            <Button style={styles.button} href="https://www.openstatus.dev/app">
              Login
            </Button>
          </Text>
          <Text>If you have any questions, please reply to this email.</Text>
          <Text>Thibault </Text>
          <Text>
            Check out our latest update{" "}
            <a href="https://www.openstatus.dev/changelog?ref=paused-email">
              here
            </a>
          </Text>
        </Layout>
      </Body>
    </Html>
  );
};

MonitorDeactivationEmail.PreviewProps = {
  // lastLogin: new Date(new Date().setDate(new Date().getDate() - 100)),
  deactivateAt: new Date(new Date().setDate(new Date().getDate() + 7)),
} satisfies MonitorDeactivationProps;

export default MonitorDeactivationEmail;
