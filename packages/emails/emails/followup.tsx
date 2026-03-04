/** @jsxImportSource react */

import { Body, Head, Html, Preview } from "@react-email/components";

const FollowUpEmail = () => {
  return (
    <Html>
      <Head>
        <title>Manage incidents from Slack</title>
      </Head>
      <Preview>Update your status page without leaving Slack</Preview>
      <Body>
        Hey
        <br />
        <br />
        Quick tip: connect the OpenStatus Slack app and manage incident updates
        for your status page directly from Slack — no need to switch tabs during
        an outage.
        <br />
        <br />👉{" "}
        <a href="https://app.openstatus.dev/agents?ref=email-followup">
          Install the Slack app
        </a>
        <br />
        <br />
        When something goes wrong, just mention @openstatus to create or update
        an incident.
        <br />
        <br />
        Hit reply if you have questions — happy to help.
        <br />
        <br />
        Thibault Le Ouay Ducasse, co-founder of OpenStatus
        <br />
      </Body>
    </Html>
  );
};

export default FollowUpEmail;
