import { components } from "@/content/mdx";
import { getCustomerPages } from "@/content/utils";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import type { Metadata } from "next";
import {
  ContentBoxDescription,
  ContentBoxImage,
  ContentBoxLink,
  ContentBoxTitle,
  ContentBoxUrl,
} from "../content-box";

const TITLE = "Meet our customers";
const DESCRIPTION =
  "Real teams using openstatus to monitor uptime, latency, and run their status pages";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/customers",
  },
  openGraph: {
    ...ogMetadata,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    ...twitterMetadata,
    title: TITLE,
    description: DESCRIPTION,
    images: [`/api/og?title=${TITLE}&description=${DESCRIPTION}`],
  },
};

export default function CustomersListPage() {
  const pages = getCustomerPages();
  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>{TITLE}</h1>
      <p className="text-lg">{DESCRIPTION}</p>
      <components.Grid cols={2}>
        {pages.map((page) => (
          <ContentBoxLink key={page.slug} href={`/customers/${page.slug}`}>
            {page.metadata.image ? (
              <ContentBoxImage
                src={page.metadata.image}
                alt={page.metadata.title}
              />
            ) : null}
            <ContentBoxTitle>{page.metadata.title}</ContentBoxTitle>
            <ContentBoxDescription>
              {page.metadata.description}
            </ContentBoxDescription>
            <ContentBoxUrl url="Read the story" />
          </ContentBoxLink>
        ))}
      </components.Grid>
    </section>
  );
}
