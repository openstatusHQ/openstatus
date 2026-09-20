/** @jsxRuntime automatic @jsxImportSource react */

import { Actions } from "./_components/actions";
import { Callout } from "./_components/callout";
import { Footer } from "./_components/footer";
import { Heading } from "./_components/heading";
import { KeyValue } from "./_components/key-value";
import { Layout } from "./_components/layout";
import { Signature } from "./_components/signature";

const SsoDisabledEmail = () => {
  return (
    <Layout
      preview="Owners can still sign in with GitHub or Google. Re-subscribing restores SSO."
      pill={{ tone: "neutral", label: "Account change" }}
      footer={<Footer reason="Sent to workspace owners." />}
    >
      <Heading title="SAML single sign-on has been turned off">
        Your subscription ended, and SSO is a paid add-on.
      </Heading>
      <Callout title="Your setup is kept">
        You can still sign in with GitHub or Google. Your identity provider
        configuration is kept, so re-subscribing restores SSO without
        reconnecting anything.
      </Callout>
      <KeyValue
        rows={[
          { label: "Sign-in methods left", value: "GitHub, Google" },
          { label: "IdP configuration", value: "Kept", tone: "success" },
        ]}
      />
      <Actions
        primary={{
          label: "View billing",
          href: "https://app.openstatus.dev/settings/billing",
        }}
        secondary={{
          label: "Compare plans",
          href: "https://www.openstatus.dev/pricing",
        }}
      />
      <Signature />
    </Layout>
  );
};

export default SsoDisabledEmail;
