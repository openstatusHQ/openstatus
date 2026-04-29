import { components } from "@/content/mdx";
import { getToolingPages } from "@/content/utils";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import type { Metadata } from "next";
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
  return (
    <section className="prose dark:prose-invert max-w-none">
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
