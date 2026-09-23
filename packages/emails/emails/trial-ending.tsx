/** @jsxRuntime automatic @jsxImportSource react */

import { Body, Head, Html, Preview } from "react-email";

import { formatDay } from "./_components/format";
import { BILLING_URL } from "./plan-downgraded";

export interface TrialEndingProps {
  trialEnd: Date;
}

export const TRIAL_ENDING_SUBJECT = "Your openstatus trial ends soon";

const TrialEndingEmail = ({ trialEnd }: TrialEndingProps) => {
  return (
    <Html>
      <Head>
        <title>{TRIAL_ENDING_SUBJECT}</title>
      </Head>
      <Preview>
        It ends on {formatDay(trialEnd)}. What happens next depends on your
        card.
      </Preview>
      <Body>
        Hey 👋
        <br />
        <br />
        Your openstatus trial ends on {formatDay(trialEnd)}.
        <br />
        <br />
        With a card on file, the plan simply continues. Without one, the
        workspace moves to the free plan that day: all but one status page are
        deleted, all but one monitor are paused, and every member except the
        owner loses access.
        <br />
        <br />👉 <a href={BILLING_URL}>Check your billing settings</a>
        <br />
        <br />
        Need more time or have a question? Hit reply — I read every response.
        <br />
        <br />
        Thibault Le Ouay Ducasse, co-founder of openstatus
        <br />
      </Body>
    </Html>
  );
};

TrialEndingEmail.PreviewProps = {
  trialEnd: new Date("2026-09-25T00:00:00Z"),
} satisfies TrialEndingProps;

export default TrialEndingEmail;
