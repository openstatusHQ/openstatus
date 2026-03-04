/** @jsxImportSource react */

import { Body, Head, Html, Preview } from "@react-email/components";

const WelcomeEmail = () => {
  return (
    <Html>
      <Head>
        <title>Welcome to OpenStatus</title>
      </Head>
      <Preview>Set up your status page in under 5 minutes</Preview>

      <Body>
        Hey 👋
        <br />
        <br />
        Thanks for signing up for OpenStatus.
        <br />
        <br />
        The fastest way to get started: create your status page. It takes under
        5 minutes and your users will have a single place to check if your
        services are up.
        <br />
        <br />👉{" "}
        <a href="https://app.openstatus.dev/status-pages/create?ref=email-onboarding">
          Create your status page
        </a>
        <br />
        <br />
        Want full control? Use our{" "}
        <a href="https://www.openstatus.dev/registry?ref=email-onboarding">
          open source
        </a>{" "}
        to build your own status page and host it anywhere.
        <br />
        <br />
        Hit reply if you get stuck — I read every response.
        <br />
        <br />
        Thibault Le Ouay Ducasse, co-founder of OpenStatus
        <br />
      </Body>
    </Html>
  );
};

export default WelcomeEmail;
