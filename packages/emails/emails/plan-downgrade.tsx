/** @jsxImportSource react */

import { Body, Head, Heading, Html, Link, Preview, Text } from "react-email";
import { z } from "zod";

import { Layout } from "./_components/layout";
import { styles } from "./_components/styles";

export const PlanDowngradeSchema = z.object({
  workspaceName: z.string().optional().nullable(),
  oldPlan: z.string().optional().nullable(),
  newPlan: z.string(),
});

export type PlanDowngradeProps = z.infer<typeof PlanDowngradeSchema>;

const PlanDowngradeEmail = ({
  workspaceName,
  oldPlan,
  newPlan,
}: PlanDowngradeProps) => {
  return (
    <Html>
      <Head />
      <Preview>Your OpenStatus workspace plan has been downgraded</Preview>
      <Body style={styles.main}>
        <Layout>
          <Heading as="h3">
            {workspaceName
              ? `The "${workspaceName}" workspace`
              : "Your workspace"}{" "}
            has been downgraded to the {newPlan} plan
          </Heading>
          <Text>
            {oldPlan
              ? `Your workspace plan changed from ${oldPlan} to ${newPlan}.`
              : `Your workspace is now on the ${newPlan} plan.`}{" "}
            Some features and limits may no longer be available. Monitors,
            status pages, notification channels or team members exceeding the
            new plan limits can be affected.
          </Text>
          <Text>
            Review your workspace in the{" "}
            <Link
              style={styles.link}
              href="https://app.openstatus.dev/settings/billing"
            >
              billing settings
            </Link>
            .
          </Text>
          <Text>If you have any questions, please reply to this email.</Text>
        </Layout>
      </Body>
    </Html>
  );
};

PlanDowngradeEmail.PreviewProps = {
  workspaceName: "OpenStatus",
  oldPlan: "team",
  newPlan: "starter",
} satisfies PlanDowngradeProps;

export default PlanDowngradeEmail;
