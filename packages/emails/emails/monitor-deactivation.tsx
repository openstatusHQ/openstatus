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
  lastLogin: z.coerce.date(),
  deactivateAt: z.coerce.date(),
  reminder: z.boolean().optional(),
});

export type MonitorDeactivationProps = z.infer<
  typeof MonitorDeactivationSchema
>;

const MonitorDeactivationEmail = ({
  lastLogin,
  deactivateAt,
  reminder,
}: MonitorDeactivationProps) => {
  return (
    <Html>
      <Head />
      <Preview>
        {reminder ? "[REMINDER] " : ""}Deactivation of your monitor(s)
      </Preview>
      <Body style={styles.main}>
        <Layout>
          <Heading as="h3">Deactivation of the your monitor(s)</Heading>
          <Text>Your last login was {lastLogin.toDateString()}.</Text>
          <Text>
            To avoid having stale monitors and reduce the number of testing
            accounts, we will deactivate your monitor(s) at{" "}
            {deactivateAt.toDateString()}.
          </Text>
          <Text>
            If you would like to keep your monitor(s) active, please login to
            your account or upgrade your plan.
          </Text>
          <Text style={{ textAlign: "center" }}>
            <Button style={styles.button} href="https://.openstatus.dev/app">
              Login
            </Button>
          </Text>
        </Layout>
      </Body>
    </Html>
  );
};

MonitorDeactivationEmail.PreviewProps = {
  lastLogin: new Date(new Date().setDate(new Date().getDate() - 100)),
  deactivateAt: new Date(new Date().setDate(new Date().getDate() + 7)),
  reminder: true,
} satisfies MonitorDeactivationProps;

export default MonitorDeactivationEmail;
