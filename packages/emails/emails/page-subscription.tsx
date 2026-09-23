/** @jsxRuntime automatic @jsxImportSource react */

import { z } from "zod";

import { Actions } from "./_components/actions";
import { Footer } from "./_components/footer";
import { Heading } from "./_components/heading";
import { Layout, statusPageBrand } from "./_components/layout";

export const PageSubscriptionSchema = z.object({
  page: z.string(),
  link: z.string(),
  img: z
    .object({
      src: z.string(),
      alt: z.string(),
      href: z.string(),
    })
    .optional(),
});

export type PageSubscriptionProps = z.infer<typeof PageSubscriptionSchema>;

const PageSubscriptionEmail = ({ page, link, img }: PageSubscriptionProps) => {
  return (
    <Layout
      preview="One click to confirm. The link is valid for 7 days."
      brand={statusPageBrand(page, img?.href ?? link, img?.src)}
      pill={{ tone: "neutral", label: "Confirm" }}
      footer={
        <Footer
          reason={`You get this because this address was subscribed to updates from ${page}. If that wasn’t you, ignore this email.`}
        />
      }
    >
      <Heading title={`Confirm your subscription to ${page}`}>
        Once confirmed, you get email updates from this status page. The link is
        valid for 7 days.
      </Heading>
      <Actions primary={{ label: "Confirm subscription", href: link }} />
    </Layout>
  );
};

PageSubscriptionEmail.PreviewProps = {
  link: "https://slug.openstatus.dev/verify/token",
  page: "Acme",
} satisfies PageSubscriptionProps;

export default PageSubscriptionEmail;
