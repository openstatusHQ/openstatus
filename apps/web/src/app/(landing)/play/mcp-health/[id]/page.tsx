import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CustomMDX } from "../../../../../content/mdx";
import { getToolsPage } from "../../../../../content/utils";
import { getHealthReportById } from "../../../../../lib/mcp/health-check";
import { JsonLd } from "../../../../../lib/metadata/json-ld";
import {
  BASE_URL,
  getPageMetadata,
} from "../../../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDWebPage,
} from "../../../../../lib/metadata/structured-data";
import { VERDICT_LABEL, formatTimestamp } from "../utils";
import { Table } from "./client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata | undefined> {
  const { id } = await params;
  const page = getToolsPage("mcp-health-slug");

  const metadata = {
    ...getPageMetadata(page, "play"),
    alternates: { canonical: `${BASE_URL}/play/mcp-health/${id}` },
  };

  const data = await getHealthReportById(id);
  if (!data) return metadata;

  const TITLE = data.url;
  const server = data.initialize.serverInfo
    ? `${data.initialize.serverInfo.name}@${data.initialize.serverInfo.version}`
    : "unknown";
  const DESCRIPTION = `${formatTimestamp(new Date(data.timestamp))} | Verdict: ${
    VERDICT_LABEL[data.verdict]
  } | Server: ${server}`;

  return {
    ...metadata,
    twitter: {
      ...metadata.twitter,
      images: [
        `/api/og?title=${encodeURIComponent(
          TITLE,
        )}&description=${encodeURIComponent(DESCRIPTION)}&category=mcp-health`,
      ],
    },
    openGraph: {
      ...metadata.openGraph,
      images: [
        `/api/og?title=${encodeURIComponent(
          TITLE,
        )}&description=${encodeURIComponent(DESCRIPTION)}&category=mcp-health`,
      ],
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const page = getToolsPage("mcp-health-slug");

  const data = await getHealthReportById(id);
  if (!data) redirect("/play/mcp-health");

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDWebPage(page),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Playground", url: `${BASE_URL}/play` },
      { name: "MCP Server Health Check", url: `${BASE_URL}/play/mcp-health` },
      { name: data.url, url: `${BASE_URL}/play/mcp-health/${id}` },
    ]),
  ]);

  return (
    <section className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1>{data.url}</h1>
      <p className="text-lg">{formatTimestamp(new Date(data.timestamp))}</p>
      <Table data={data} />
      <CustomMDX source={page.content} />
    </section>
  );
}
