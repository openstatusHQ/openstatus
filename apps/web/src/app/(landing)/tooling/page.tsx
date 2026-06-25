import type { Metadata } from "next";

import { components } from "@/content/mdx";
import { getToolingPages } from "@/content/utils";
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

const TITLE = "Manage openstatus from anywhere";
const DESCRIPTION =
  "Manage status pages and uptime monitoring from anywhere your workflow lives — CLI, ConnectRPC API, Node SDK, Terraform provider, and MCP server, all on a single API key.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/tooling",
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

export default function ToolingListPage() {
  const pages = getToolingPages();
  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Tooling", url: `${BASE_URL}/tooling` },
    ]),
    getJsonLDItemList(pages, "/tooling"),
  ]);
  return (
    <section className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1>{TITLE}</h1>
      <components.Grid cols={2}>
        {pages.map((page) => (
          <ContentBoxLink key={page.slug} href={`/tooling/${page.slug}`}>
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
