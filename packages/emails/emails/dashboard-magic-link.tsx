/** @jsxRuntime automatic @jsxImportSource react */

import { Actions } from "./_components/actions";
import { Footer } from "./_components/footer";
import { Heading } from "./_components/heading";
import { Layout } from "./_components/layout";

export interface DashboardMagicLinkProps {
  link: string;
}

const DashboardMagicLinkEmail = ({ link }: DashboardMagicLinkProps) => {
  return (
    <Layout
      preview="One click to sign in. The link is valid for 24 hours."
      pill={{ tone: "neutral", label: "Sign in" }}
      footer={
        <Footer reason="You get this because a sign-in to openstatus was requested for this address. If that wasn’t you, ignore this email." />
      }
    >
      <Heading title="Sign in to openstatus">
        The link below signs you in and is valid for 24 hours. It only works
        once.
      </Heading>
      <Actions primary={{ label: "Sign in", href: link }} />
    </Layout>
  );
};

DashboardMagicLinkEmail.PreviewProps = {
  link: "https://app.openstatus.dev/api/auth/callback/resend?token=token-xyz",
} satisfies DashboardMagicLinkProps;

export default DashboardMagicLinkEmail;
