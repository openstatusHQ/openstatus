/** @jsxImportSource react */

import { Body, Head, Html, Preview } from "@react-email/components";

const WelcomeEmail = () => {
  return (
    <Html>
      <Head>
        <title>Welcome to OpenStatus</title>
        <Preview>Few tips to get started</Preview>
        <Body>
          Hey 👋
          <br />
          <br />
          I'm Thibault, the co-founder of OpenStatus, the open-source synthetic
          monitoring platform. <br />
          <br />
          <br />
          <br />
          Here are a few things you can do with OpenStatus:
          <br />- Run your synthetics checks in your{" "}
          <a href="https://docs.openstatus.dev/guides/how-to-run-synthetic-test-github-action?ref=email-onboarding">
            GitHub Actions
          </a>
          <br />- Use our{" "}
          <a href="https://docs.openstatus.dev/tools/terraform?ref=email-onboarding">
            Terraform provider
          </a>{" "}
          to manage your monitors
          <br />- Build your own status page with our{" "}
          <a href="https://api.openstatus.dev/v1">API</a> and host it where you
          want. Here's our{" "}
          <a href="https://github.com/openstatusHQ/astro-status-page?ref=email-onboarding">
            Astro template
          </a>{" "}
          that you can easily host on CloudFlare
          <br />
          <br />
          Quick question: How did you learn about us? and why did you sign up?
          <br />
          Thank you,
          <br />
          <br />
          Thibault Le Ouay Ducasse
          <br />
        </Body>
      </Head>
    </Html>
  );
};

export default WelcomeEmail;
