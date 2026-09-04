/** @jsxRuntime automatic @jsxImportSource react */

import { Body, Button, Head, Heading, Html, Preview, Text } from "react-email";
import { z } from "zod";

import { Layout } from "./_components/layout";
import { colors, styles } from "./_components/styles";

const PrivateLocationAlertSchema = z.object({
  locationName: z.string(),
  status: z.enum(["error", "recovered"]),
  lastSeenAt: z.string(),
});

export type PrivateLocationAlertProps = z.infer<
  typeof PrivateLocationAlertSchema
>;

const PrivateLocationAlertEmail = (props: PrivateLocationAlertProps) => {
  const isError = props.status === "error";
  const preview = isError
    ? `Your private location "${props.locationName}" is unhealthy`
    : `Your private location "${props.locationName}" is healthy again`;

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.main}>
        <Layout>
          <Heading
            as="h4"
            style={{ color: isError ? colors.danger : colors.success }}
          >
            {preview}
          </Heading>
          {isError ? (
            <Text>
              The agent for <strong>{props.locationName}</strong> has not
              reported a result in over 15 minutes, so checks scheduled on this
              location are not running. It was last seen at {props.lastSeenAt}.
            </Text>
          ) : (
            <Text>
              The agent for <strong>{props.locationName}</strong> is reporting
              again and checks on this location have resumed. It was last seen
              at {props.lastSeenAt}.
            </Text>
          )}
          <Text>
            {isError
              ? "Check that the agent is running and can reach OpenStatus, then verify its token and network access."
              : "No action is needed."}
          </Text>
          <Text style={{ textAlign: "center" }}>
            <Button
              style={styles.button}
              href="https://www.openstatus.dev/app/settings/private-locations"
            >
              View private locations
            </Button>
          </Text>
          <Text>If you have any questions, please reply to this email.</Text>
        </Layout>
      </Body>
    </Html>
  );
};

PrivateLocationAlertEmail.PreviewProps = {
  locationName: "eu-west-agent",
  status: "error",
  lastSeenAt: "2026-07-23T10:00:00Z",
} satisfies PrivateLocationAlertProps;

export default PrivateLocationAlertEmail;
