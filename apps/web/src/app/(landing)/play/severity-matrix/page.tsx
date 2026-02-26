import { CustomMDX } from "@/content/mdx";
import { getToolsPage } from "@/content/utils";
import { BASE_URL, getPageMetadata } from "@/lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDFAQPage,
  getJsonLDWebPage,
} from "@/lib/metadata/structured-data";
import type { Metadata } from "next";
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
      <script
        type="application/ld+json"
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLDGraph).replace(/</g, "\\u003c"),
        }}
      />
      <h1>{page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <SeverityMatrixBuilder />
      <CustomMDX source={page.content} />
    </section>
  );
}
