/** @jsxRuntime automatic @jsxImportSource react */

import { Body, Button, Head, Html, Preview, Text } from "react-email";

import { Layout } from "./_components/layout";
import { styles } from "./_components/styles";

const SsoDisabledEmail = () => {
  return (
    <Html>
      <Head />
      <Preview>Single sign-on has been turned off for your workspace</Preview>
      <Body style={styles.main}>
        <Layout>
          <Text>Hello 👋</Text>
          <Text>
            Your subscription ended, so SAML single sign-on has been turned off
            for your workspace. SSO is part of the Scale plan.
          </Text>
          <Text>
            Nobody has lost access — everyone can still sign in with GitHub or
            Google. Your identity provider configuration has been kept, so
            re-subscribing to Scale restores SSO without reconnecting it.
          </Text>
          <Text style={{ textAlign: "center" }}>
            <Button
              style={styles.button}
              href="https://app.openstatus.dev/settings/billing"
            >
              View billing
            </Button>
          </Text>
          <Text>If you have any questions, please reply to this email.</Text>
          <Text>Thibault</Text>
        </Layout>
      </Body>
    </Html>
  );
};

export default SsoDisabledEmail;
