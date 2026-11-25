import type { Metadata } from "next";

import { HomeAskAi } from "../../content/home-ask-ai";
import { CustomMDX } from "../../content/mdx";
import { getHomePage } from "../../content/utils";
import { JsonLd } from "../../lib/metadata/json-ld";
import { getHomeMetadata } from "../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDFAQPage,
  getJsonLDHowTo,
  getJsonLDOrganization,
  getJsonLDProduct,
  getJsonLDSoftwareApplication,
  getJsonLDWebPage,
} from "../../lib/metadata/structured-data";

// Demos derive "today" from `new Date()`; re-render so their dates keep moving.
export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return getHomeMetadata(getHomePage());
}

export default function Page() {
  const homePage = getHomePage();
  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDProduct(),
    getJsonLDSoftwareApplication(),
    getJsonLDWebPage(homePage),
    getJsonLDHowTo(homePage),
    getJsonLDFAQPage(homePage),
  ]);

  return (
    <div className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <HomeAskAi title={homePage.metadata.title} />
      <h1>{homePage.metadata.hero ?? homePage.metadata.title}</h1>
      <p>{homePage.metadata.description}</p>
      <CustomMDX source={homePage.content} />
    </div>
  );
}
