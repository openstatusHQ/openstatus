/** @jsxImportSource react */

import { Body, Head, Html, Preview } from "@react-email/components";

const FeedbackEmail = () => {
  return (
    <Html>
      <Head>
        <title>One quick question</title>
      </Head>
      <Preview>What's the one thing you'd change about OpenStatus?</Preview>
      <Body>
        Hey
        <br />
        <br />
        You've been on OpenStatus for about two weeks now. One quick question:
        <br />
        <br />
        What's the one thing you wish OpenStatus did differently?
        <br />
        <br />
        No survey, no form — just hit reply. I read every response and it
        genuinely shapes what we build next.
        <br />
        <br />
        Thibault Le Ouay Ducasse, co-founder of OpenStatus
        <br />
      </Body>
    </Html>
  );
};

export default FeedbackEmail;
