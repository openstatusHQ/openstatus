/** @jsxImportSource react */

import { Body, Head, Html, Preview } from "@react-email/components";

const SlackFeedbackEmail = () => {
  return (
    <Html>
      <Head>
        <title>How's the Slack app working for you?</title>
      </Head>
      <Preview>We'd love your feedback on the OpenStatus Slack app</Preview>
      <Body>
        Hey
        <br />
        <br />I saw you installed the OpenStatus Slack app — thanks for trying
        it out!
        <br />
        <br />
        Quick question: how's the incident management from Slack going so far?
        <br />
        <br />
        Anything missing or confusing? I'd love to hear what's working and what
        we could improve.
        <br />
        <br />
        Just hit reply — I read every response.
        <br />
        <br />
        Thibault Le Ouay Ducasse, co-founder of OpenStatus
        <br />
      </Body>
    </Html>
  );
};

export default SlackFeedbackEmail;
