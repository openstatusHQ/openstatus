import { Body, Head, Html, Link, Preview } from "@react-email/components";

const SubscribeEmail = ({
  token,
  page,
  domain,
}: {
  token: string;
  page: string;
  domain: string;
}) => {
  return (
    <Html>
      <Head>
        <title>Confirm your subscription to {page} Status Page</title>
        <Preview>Confirm your subscription to {page} Status Page</Preview>
        <Body>
          <p>Confirm your subscription to {page} Status Page</p>
          <p>
            You are receiving this email because you subscribed to receive
            updates from {page} Status Page.
          </p>
          <p>
            To confirm your subscription, please click the link below. If you
            believe this is a mistake, please ignore this email.
          </p>
          <p>
            <a href={`https://${domain}.openstatus.dev/verify/${token}`}>
              Confirm subscription
            </a>
          </p>
          <br />
          🚀 Powered by{" "}
          <Link href="https://www.openstatus.dev">OpenStatus.dev</Link>
        </Body>
      </Head>
    </Html>
  );
};

export default SubscribeEmail;
