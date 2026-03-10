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
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLd
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLDGraph).replace(/</g, "\\u003c"),
        }}
      />

      {/* Hero Section */}
      <section className="px-4 py-8">
        <div className="prose dark:prose-invert max-w-none">
          <h1>{homePage.metadata.title}</h1>
          <p className="text-lg">{homePage.metadata.description}</p>
        </div>
      </section>

      {/* How It Works Section */}
      <HowItWorks />

      {/* Features Section (from MDX content) */}
      <section className="px-4 py-8">
        <div className="prose dark:prose-invert max-w-none">
          <CustomMDX source={homePage.content} />
        </div>
      </section>
    </>
  );
}
