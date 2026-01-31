import {
  BASE_URL,
  getJsonLDBreadcrumbList,
  getPageMetadata,
} from "@/app/shared-metadata";
import { CustomMDX } from "@/content/mdx";
import { getToolsPage } from "@/content/utils";
import type { Metadata } from "next";
import type { BreadcrumbList, WithContext } from "schema-dts";
import { Calculation } from "./client";

export function generateMetadata(): Metadata {
  const page = getToolsPage("uptime-sla");
  return getPageMetadata(page);
}

export default function Page() {
  const page = getToolsPage("uptime-sla");

  const jsonLDBreadcrumb: WithContext<BreadcrumbList> = getJsonLDBreadcrumbList(
    [
      { name: "Home", url: BASE_URL },
      { name: "Playground", url: `${BASE_URL}/play` },
      { name: page.metadata.title, url: `${BASE_URL}/play/uptime-sla` },
    ],
  );

  return (
    <section className="prose dark:prose-invert max-w-none space-y-4">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLDBreadcrumb).replace(/</g, "\\u003c"),
        }}
      />
      <h1>{page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <Calculation />
      <CustomMDX source={page.content} />
    </section>
  );
}
