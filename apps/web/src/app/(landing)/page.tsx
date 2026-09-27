import type { Metadata } from "next";

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

const homePage = getHomePage();

export const metadata: Metadata = getHomeMetadata(homePage);

export default function Page() {
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
      <h1>{homePage.metadata.hero ?? homePage.metadata.title}</h1>
      <p className="text-lg">{homePage.metadata.description}</p>
      <CustomMDX source={homePage.content} />
    </div>
  );
}
