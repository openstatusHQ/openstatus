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
import { HowItWorks } from "@/components/marketing/how-it-works";

export const metadata: Metadata = defaultMetadata;

export default function Page() {
  const homePage = getHomePage();

  // Split MDX content: hero section (before first ## heading) vs features (the rest)
  const firstH2Index = homePage.content.indexOf("\n## ");
  const heroContent =
    firstH2Index !== -1 ? homePage.content.slice(0, firstH2Index) : "";
  const featuresContent =
    firstH2Index !== -1 ? homePage.content.slice(firstH2Index) : homePage.content;

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDProduct(),
    getJsonLDSoftwareApplication(),
    getJsonLDWebPage(homePage),
    getJsonLDHowTo(homePage),
    getJsonLDFAQPage(homePage),
  ]);

  return (
    <>
      <div className="prose dark:prose-invert max-w-none">
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLd
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLDGraph).replace(/</g, "\\u003c"),
          }}
        />
        <h1>{homePage.metadata.title}</h1>
        <p className="text-lg">{homePage.metadata.description}</p>
        <CustomMDX source={heroContent} />
      </div>

      {/* How it works — between hero and features */}
      <HowItWorks />

      <div className="prose dark:prose-invert max-w-none">
        <CustomMDX source={featuresContent} />
      </div>
    </>
  );
}
