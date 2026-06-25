import type { Metadata } from "next";

import { CustomMDX } from "@/content/mdx";
import { getToolsPage } from "@/content/utils";
import { getHealthReportById } from "@/lib/mcp/health-check";
import { JsonLd } from "@/lib/metadata/json-ld";
import { BASE_URL, getPageMetadata } from "@/lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDFAQPage,
  getJsonLDHowTo,
  getJsonLDWebPage,
} from "@/lib/metadata/structured-data";

import {
  AuthChallengeCallout,
  DetailsButtonLink,
  Form,
  McpHealthProvider,
  ResultTable,
  ToolsTable,
  VerdictBar,
} from "./client";
import { searchParamsCache } from "./search-params";

export function generateMetadata(): Metadata {
  const page = getToolsPage("mcp-health");
  return getPageMetadata(page, "play");
}

export default async function Page(props: {
  searchParams: Promise<{ id?: string }>;
}) {
  const page = getToolsPage("mcp-health");

  const searchParams = await props.searchParams;
  const { id } = searchParamsCache.parse(searchParams);

  const sharedReport = id ? await getHealthReportById(id) : null;

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDWebPage(page),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Playground", url: `${BASE_URL}/play` },
      { name: page.metadata.title, url: `${BASE_URL}/play/mcp-health` },
    ]),
    getJsonLDFAQPage(page),
    getJsonLDHowTo(page),
  ]);

  return (
    <section className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1>{page.metadata.hero ?? page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <McpHealthProvider defaultReport={sharedReport}>
        <Form defaultUrl={sharedReport?.url ?? ""} />
        <VerdictBar />
        <ResultTable />
        <AuthChallengeCallout />
        <ToolsTable />
        <div className="flex w-full gap-2">
          <DetailsButtonLink />
        </div>
      </McpHealthProvider>
      <CustomMDX source={page.content} />
    </section>
  );
}
