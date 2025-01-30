/** @jsxImportSource react */

import { Body, Head, Html, Link, Preview } from "@react-email/components";

const WelcomeEmail = () => {
  return (
    <Html>
      <Head>
        <title>Welcome to OpenStatus</title>
        <Preview>Take the most of your OpenStatus monitoring</Preview>
        <Body>
          Hey 👋
          <br />
          <br />
          I'm Thibault <a href="https://www.openstatus.dev">OpenStatus</a>{" "}
          co-founder.
          <br />
          <br /> I'm thrilled to see you joining us. We are building an
          open-source status page and monitoring tool. We are here to help you
          monitor your websites and API to get notified before your users alert
          you.
          <br />
          <br />
          Here are a few things you can do with OpenStatus:
          <br />- Use our{" "}
          <a href="https://docs.openstatus.dev/tools/terraform">
            Terraform provider
          </a>{" "}
          to manage your monitors
          <br />- Integrate your status within your application with our{" "}
          <a href="https://docs.openstatus.dev/tools/status-widget">API</a> and{" "}
          <a href="https://docs.openstatus.dev/tools/react/">React Widget</a>
          <br />- Build your own status page with our{" "}
          <a href="https://api.openstatus.dev/v1">API</a> and host it where you
          want. Here's our{" "}
          <a href="https://github.com/openstatusHQ/astro-status-page">
            Astro template
          </a>{" "}
          that you can easily host on CloudFlare
          <br />
          <br />
          If you have any questions, just let me know, or book a call with me{" "}
          <a href="https://cal.com/team/openstatus/30min">here</a>.
          <br />
          Thank you,
          <br />
          <br />
          Thibault Le Ouay Ducasse
          <br />
          <br />⭐ Star us on{" "}
          <Link href="https://github.com/openstatushq/openstatus">GitHub</Link>
          <br />🚀 Visit our website{" "}
          <Link href="https://www.openstatus.dev">OpenStatus.dev</Link>
        </Body>
      </Head>
    </Html>
  );
};

export default WelcomeEmail;
