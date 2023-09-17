import { Body, Head, Html, Link, Preview } from "@react-email/components";

const WelcomeEmail = () => {
  return (
    <Html>
      <Head>
        <title>Welcome to OpenStatus.dev 👋</title>
        <Preview>Welcome to OpenStatus.dev 👋</Preview>
        <Body>
          Hey!
          <br />
          <br />
          Welcome to OpenStatus.dev! We're excited to have you on board.
          <br /> I hope you will enjoy using our product as much as we enjoyed
          building it.
          <br />
          <br />
          What kind of apps are going to monitor?
          <br />
          Where do you host your apps?
          <br />
          <br />
          Thank you,
          <br />
          <br />
          Thibault Le Ouay Ducasse
          <br />
          <br />⭐ Star us on{" "}
          <Link href="https://github.com/openstatushq/openstatus">GitHub</Link>
          <br />
          🚀 Visit our website{" "}
          <Link href="https://www.openstatus.dev">OpenStatus.dev</Link>
        </Body>
      </Head>
    </Html>
  );
};

export default WelcomeEmail;
