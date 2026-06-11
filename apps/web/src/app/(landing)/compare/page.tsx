import type { Metadata } from "next";

import { components } from "@/content/mdx";
import { getComparePages } from "@/content/utils";
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

const TITLE = "Compare openstatus with uptime and status page solutions";
const DESCRIPTION =
  "See how openstatus compares to BetterStack, UptimeRobot, Checkly, Instatus, and other monitoring tools. Side-by-side feature and pricing comparisons to help you choose the right solution.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/compare",
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

export default function Page() {
  const pages = getComparePages();
  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Compare", url: `${BASE_URL}/compare` },
    ]),
    getJsonLDItemList(pages, "/compare"),
  ]);
  return (
    <section className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1>{TITLE}</h1>
      <components.Grid cols={2}>
        {pages.map((page) => (
          <ContentBoxLink key={page.slug} href={`/compare/${page.slug}`}>
            <ContentBoxTitle>{page.metadata.title}</ContentBoxTitle>
            <ContentBoxDescription>
              {page.metadata.description}
            </ContentBoxDescription>
            <ContentBoxUrl url="Read more" />
          </ContentBoxLink>
        ))}
      </components.Grid>
    </section>
  );
}
