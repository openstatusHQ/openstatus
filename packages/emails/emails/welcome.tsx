/** @jsxRuntime automatic @jsxImportSource react */

import { Link, Text } from "react-email";

import { Footer } from "./_components/footer";
import { formatDay } from "./_components/format";
import { Heading } from "./_components/heading";
import { Layout } from "./_components/layout";
import { Signature } from "./_components/signature";
import { Steps } from "./_components/steps";
import { styles } from "./_components/styles";

const REF = "ref=email-onboarding";

const links = [
  {
    label: "Agents",
    href: `https://app.openstatus.dev/agents?${REF}`,
    description:
      "manage incidents from Slack, your editor via MCP, or the CLI.",
  },
  {
    label: "Docs",
    href: `https://www.openstatus.dev/docs?${REF}`,
    description: "tutorials, guides and the full reference.",
  },
  {
    label: "Discord",
    href: `https://www.openstatus.dev/discord?${REF}`,
    description: "ask questions and talk to us and other users.",
  },
  {
    label: "Changelog",
    href: `https://www.openstatus.dev/changelog?${REF}`,
    description: "what we shipped recently.",
  },
];

export interface WelcomeEmailProps {
  trialEndsAt?: Date;
}

const WelcomeEmail = ({ trialEndsAt }: WelcomeEmailProps = {}) => {
  return (
    <Layout
      preview="Agents, docs and where to find us"
      pill={{ tone: "neutral", label: "Welcome" }}
      footer={
        <Footer reason="You get this because you signed up for openstatus." />
      }
    >
      <Heading title="Welcome to openstatus">
        Thanks for signing up. A few places worth knowing about while you get
        set up.
      </Heading>
      {trialEndsAt ? (
        <Text style={styles.text}>
          Your workspace is on a 14-day Starter trial until{" "}
          {formatDay(trialEndsAt)}, no card needed.
        </Text>
      ) : null}
      <Steps
        label="Links"
        variant="dashed"
        items={links.map((l) => (
          <>
            <Link href={l.href} style={styles.link}>
              {l.label}
            </Link>
            {": "}
            {l.description}
          </>
        ))}
      />
      <Text style={{ ...styles.text, margin: 0 }}>
        Hit reply if you get stuck. I read every response.
      </Text>
      <Signature />
    </Layout>
  );
};

WelcomeEmail.PreviewProps = {
  trialEndsAt: new Date("2026-10-07T00:00:00Z"),
} satisfies WelcomeEmailProps;

export default WelcomeEmail;
