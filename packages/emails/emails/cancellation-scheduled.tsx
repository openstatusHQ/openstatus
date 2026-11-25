/** @jsxRuntime automatic @jsxImportSource react */

import { Body, Head, Html, Preview } from "react-email";

import { formatDay } from "./_components/format";
import { BILLING_URL } from "./plan-downgraded";

export interface CancellationScheduledProps {
  plan: string;
  endsAt: Date;
  /** Short plain-text lines, e.g. "2 status pages get deleted". */
  losses: string[];
}

export const CANCELLATION_SCHEDULED_SUBJECT = "Your openstatus cancellation";

const CancellationScheduledEmail = ({
  plan,
  endsAt,
  losses,
}: CancellationScheduledProps) => {
  return (
    <Html>
      <Head>
        <title>{CANCELLATION_SCHEDULED_SUBJECT}</title>
      </Head>
      <Preview>
        Your plan runs until {formatDay(endsAt)}. One question if you have a
        minute.
      </Preview>
      <Body>
        Hey 👋
        <br />
        <br />I saw you cancelled your {plan} plan. It keeps running until{" "}
        {formatDay(endsAt)}, nothing changes before then.
        <br />
        <br />
        {losses.length > 0 ? (
          <>
            On that day the workspace moves to the free plan, which means:
            <br />
            {losses.map((loss) => (
              <span key={loss}>
                – {loss}
                <br />
              </span>
            ))}
            <br />
          </>
        ) : null}
        Changed your mind? You can{" "}
        <a href={BILLING_URL}>resume the subscription</a> any time before it
        ends.
        <br />
        <br />
        One question, if you have a minute: what made you cancel? Hit reply — I
        read every response, and it is the most useful thing you can tell us.
        <br />
        <br />
        Thibault Le Ouay Ducasse, co-founder of openstatus
        <br />
      </Body>
    </Html>
  );
};

CancellationScheduledEmail.PreviewProps = {
  plan: "team",
  endsAt: new Date("2026-09-25T00:00:00Z"),
  losses: [
    "1 status page gets deleted (Acme API)",
    "11 monitors get paused",
    "4 members lose access",
  ],
} satisfies CancellationScheduledProps;

export default CancellationScheduledEmail;
