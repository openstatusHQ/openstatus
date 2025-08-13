/** @jsxImportSource react */

import { Body, Head, Html, Preview } from "@react-email/components";

const WelcomeEmail = () => {
  return (
    <Html>
      <Head>
        <title>Welcome to openstatus</title>
      </Head>
      <Preview>Few tips to get started with your uptime monitoring</Preview>

      <Body>
        Hey 👋
        <br />
        <br />
        Welcome to openstatus <br />
        <br />
        <br />
        Openstatus is global uptime monitoring service with status page.
        <br />
        Here are a few things you can do with openstatus:
        <br />- Use our{" "}
        <a href="https://docs.openstatus.dev/cli/getting-started/?ref=email-onboarding">
          CLI
        </a>{" "}
        to create, update and trigger your monitors.
        <br />- Learn how to monitor a{" "}
        <a href="https://docs.openstatus.dev/guides/how-to-monitor-mcp-server?ref=email-onboarding">
          MCP server
        </a>.
        <br />- Explore our uptime monitoring as code {" "}<a href="https://github.com/openstatusHQ/cli-template/?ref=email-onboarding">
template directory</a>.
        <br />- Build your own status page with our{" "}
        <a href="https://api.openstatus.dev/v1">API</a> and host it where you
        want. Here's our{" "}
        <a href="https://github.com/openstatusHQ/astro-status-page">
          Astro template
        </a>{" "}
        that you can easily host on CloudFlare.
        <br />
        <br />
        Quick question: How did you learn about us? and why did you sign up?
        <br />
        Thank you,
        <br />
        <br />
        Thibault Le Ouay Ducasse, co-founder of openstatus
        <br />
      </Body>
    </Html>
  );
};

export default WelcomeEmail;
