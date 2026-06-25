import type { Metadata } from "next";

import { components } from "@/content/mdx";
import { getCustomerPages } from "@/content/utils";
import { JsonLd } from "@/lib/metadata/json-ld";
import {
  BASE_URL,
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDItemList,
  getJsonLDOrganization,
} from "@/lib/metadata/structured-data";

import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
  ContentBoxUrl,
} from "../content-box";
import { ContentBoxImage } from "../content-box-image";

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
  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Customers", url: `${BASE_URL}/customers` },
    ]),
    getJsonLDItemList(pages, "/customers"),
  ]);
  return (
    <section className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
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
