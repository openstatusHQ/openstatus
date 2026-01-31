import {
  getCheckerDataById,
  latencyFormatter,
  regionFormatter,
} from "@/components/ping-response-analysis/utils";
import { CustomMDX } from "@/content/mdx";
import { getToolsPage } from "@/content/utils";
import { BASE_URL, getPageMetadata } from "@/lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDWebPage,
} from "@/lib/metadata/structured-data";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { mockCheckAllRegions } from "../api/mock";
import { Table } from "./client";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const { slug } = await params;
  const page = getToolsPage("checker-slug");

  const metadata = getPageMetadata(page);

  const data =
    process.env.NODE_ENV === "development"
      ? await mockCheckAllRegions()
      : await getCheckerDataById(slug);

  if (!data) return metadata;

  const regions = data.checks.sort((a, b) => a.latency - b.latency);
  const fastestRegion = regions[0];
  const slowestRegion = regions[regions.length - 1];

  const TITLE = data.url;
  const DESCRIPTION = `${formatDate(
    new Date(data.timestamp),
  )} | Fastest: ${regionFormatter(fastestRegion.region)} (${latencyFormatter(
    fastestRegion.latency,
  )}) | Slowest: ${regionFormatter(slowestRegion.region)} (${latencyFormatter(
    slowestRegion.latency,
  )})`;

  return {
    ...metadata,
    twitter: {
      ...metadata.twitter,
      images: [
        `/api/og?title=${encodeURIComponent(
          TITLE,
        )}&description=${encodeURIComponent(DESCRIPTION)}&category=checker`,
      ],
    },
    openGraph: {
      ...metadata.openGraph,
      images: [
        `/api/og?title=${encodeURIComponent(
          TITLE,
        )}&description=${encodeURIComponent(DESCRIPTION)}&category=checker`,
      ],
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getToolsPage("checker-slug");

  const data =
    process.env.NODE_ENV === "development"
      ? await mockCheckAllRegions()
      : await getCheckerDataById(slug);

  if (!data) redirect("/play/checker");

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDWebPage(page),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Playground", url: `${BASE_URL}/play` },
      { name: "Speed Checker", url: `${BASE_URL}/play/checker` },
      { name: data.url, url: `${BASE_URL}/play/checker/${slug}` },
    ]),
  ]);

  return (
    <section className="prose dark:prose-invert max-w-none">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLDGraph).replace(/</g, "\\u003c"),
        }}
      />
      <h1>{data.url}</h1>
      <p className="text-lg">{formatDate(new Date(data.timestamp))}</p>
      <Table data={data} />
      <CustomMDX source={page.content} />
    </section>
  );
}
