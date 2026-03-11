import { HowItWorks } from "@/components/marketing/how-it-works";
import { CustomMDX } from "@/content/mdx";
import { getHomePage } from "@/content/utils";
import { defaultMetadata } from "@/lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDFAQPage,
  getJsonLDHowTo,
  getJsonLDOrganization,
  getJsonLDProduct,
  getJsonLDSoftwareApplication,
  getJsonLDWebPage,
} from "@/lib/metadata/structured-data";
import type { Metadata } from "next";

export const metadata: Metadata = defaultMetadata;

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
    <div className="flex flex-col">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLd
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLDGraph).replace(/</g, "\\u003c"),
        }}
      />
      <div className="prose dark:prose-invert max-w-none">
        <h1>{homePage.metadata.title}</h1>
        <p className="text-lg">{homePage.metadata.description}</p>
      </div>
      <HowItWorks />
      <div className="prose dark:prose-invert max-w-none">
        <CustomMDX source={homePage.content} />
      </div>
    </div>
  );
}
