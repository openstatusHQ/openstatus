/** @jsxRuntime automatic @jsxImportSource react */

import { Actions } from "./_components/actions";
import { Footer } from "./_components/footer";
import { Heading } from "./_components/heading";
import { Layout, statusPageBrand } from "./_components/layout";

export interface StatusPageMagicLinkProps {
  page: string;
  link: string;
}

const StatusPageMagicLinkEmail = ({ page, link }: StatusPageMagicLinkProps) => {
  return (
    <Layout
      preview="One click to sign in. The link is valid for 24 hours."
      brand={statusPageBrand(page, link)}
      pill={{ tone: "neutral", label: "Sign in" }}
      footer={
        <Footer
          reason={`You get this because access to ${page} was requested for this address. If that wasn’t you, ignore this email.`}
        />
      }
    >
      <Heading title={`Sign in to ${page}`}>
        This status page is private. The link below signs you in and is valid
        for 24 hours.
      </Heading>
      <Actions primary={{ label: "Open status page", href: link }} />
    </Layout>
  );
};

StatusPageMagicLinkEmail.PreviewProps = {
  page: "Acme",
  link: "https://slug.openstatus.dev/verify/token-xyz",
} satisfies StatusPageMagicLinkProps;

export default StatusPageMagicLinkEmail;
