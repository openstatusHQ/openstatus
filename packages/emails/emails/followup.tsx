/** @jsxImportSource react */

import { Body, Head, Html, Link, Preview } from "@react-email/components";

const FollowUpEmail = () => {
  return (
    <Html>
      <Head>
        <title>How's it going with OpenStatus?</title>
        <Preview>How's it going with OpenStatus?</Preview>
        <Body>
          Hey
          <br />
          <br />
          How’s everything going with OpenStatus so far? Let me know if you run
          into any issues, or have any feedback, good or bad!
          <br />
          <br />
          Feel free to shoot me an email or schedule a call with me{" "}
          <a href="https://cal.com/team/openstatus/30min">here</a>
          .
          <br />
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

export default FollowUpEmail;
