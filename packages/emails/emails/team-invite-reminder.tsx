/** @jsxImportSource react */

import { Body, Head, Html, Preview } from "@react-email/components";

const TeamInviteReminderEmail = () => {
  return (
    <Html>
      <Head>
        <title>Incidents are a team sport</title>
      </Head>
      <Preview>Invite your team so everyone can manage status updates</Preview>
      <Body>
        Hey
        <br />
        <br />
        When something goes down at 2am, you don't want to be the only one who
        can update the status page.
        <br />
        <br />👉{" "}
        <a href="https://app.openstatus.dev/settings/general?ref=email-team-invite">
          Invite your team
        </a>
        <br />
        <br />
        Everyone gets access to monitors, incidents, and status pages — so
        whoever is on-call can respond without waiting on you.
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

export default TeamInviteReminderEmail;
