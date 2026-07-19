import type { Metadata } from "next";

import { CustomMDX } from "../../../../content/mdx";
import { getToolsPage } from "../../../../content/utils";
import { JsonLd } from "../../../../lib/metadata/json-ld";
import {
  BASE_URL,
  getPageMetadata,
} from "../../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDFAQPage,
  getJsonLDWebPage,
} from "../../../../lib/metadata/structured-data";
import { SeverityMatrixBuilder } from "./client";

export function generateMetadata(): Metadata {
  const page = getToolsPage("severity-matrix");
  return getPageMetadata(page, "play");
}

export default function Page() {
  const page = getToolsPage("severity-matrix");

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDWebPage(page),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Playground", url: `${BASE_URL}/play` },
      { name: page.metadata.title, url: `${BASE_URL}/play/severity-matrix` },
    ]),
    getJsonLDFAQPage(page),
  ]);

  return (
    <section className="prose dark:prose-invert max-w-none space-y-4">
      <JsonLd graph={jsonLDGraph} />
      <h1>{page.metadata.hero ?? page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <SeverityMatrixBuilder />
      <CustomMDX source={page.content} />
    </section>
  );
}
