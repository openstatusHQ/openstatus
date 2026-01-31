import { CustomMDX } from "@/content/mdx";
import { getToolsPage } from "@/content/utils";
import { BASE_URL, getPageMetadata } from "@/lib/metadata/shared-metadata";
import { getJsonLDBreadcrumbList } from "@/lib/metadata/structured-data";
import type { Metadata } from "next";
import type { BreadcrumbList, WithContext } from "schema-dts";
import { Form } from "./client";

export function generateMetadata(): Metadata {
  const page = getToolsPage("curl");
  return getPageMetadata(page);
}

export default function Page() {
  const page = getToolsPage("curl");

  const jsonLDBreadcrumb: WithContext<BreadcrumbList> = getJsonLDBreadcrumbList(
    [
      { name: "Home", url: BASE_URL },
      { name: "Playground", url: `${BASE_URL}/play` },
      { name: page.metadata.title, url: `${BASE_URL}/play/curl` },
    ],
  );

  return (
    <section className="prose dark:prose-invert max-w-none">
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
      <Form />
      <CustomMDX source={page.content} />
    </section>
  );
}
