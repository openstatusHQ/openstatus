import type { Metadata } from "next";
import { Suspense } from "react";

import { CustomMDX } from "@/content/mdx";
import { getToolsPage } from "@/content/utils";
import { JsonLd } from "@/lib/metadata/json-ld";
import { BASE_URL, getPageMetadata } from "@/lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDFAQPage,
  getJsonLDWebPage,
} from "@/lib/metadata/structured-data";

import { CdnCheckerProvider, CdnForm } from "./client";
import { MonitorCta } from "./components/monitor-cta";
import { CacheStatusLegend, ResultsTable } from "./components/results-table";
import { SummaryCard } from "./components/summary-card";

export function generateMetadata(): Metadata {
  const page = getToolsPage("cdn-checker");
  return getPageMetadata(page, "play");
}

export default function Page() {
  const page = getToolsPage("cdn-checker");

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDWebPage(page),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Playground", url: `${BASE_URL}/play` },
      { name: page.metadata.title, url: `${BASE_URL}/play/cdn-checker` },
    ]),
    getJsonLDFAQPage(page),
  ]);

  return (
    <section className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1>{page.metadata.hero ?? page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <Suspense>
        <CdnCheckerProvider>
          <CdnForm />
          <CacheStatusLegend />
          <SummaryCard />
          <ResultsTable />
          <MonitorCta />
        </CdnCheckerProvider>
      </Suspense>
      <p className="text-muted-foreground text-sm">
        Checks run live — results are not stored.
      </p>
      <CustomMDX source={page.content} />
    </section>
  );
}
