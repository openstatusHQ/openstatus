import type { Metadata } from "next";

import { components } from "../../../content/mdx";
import { sections } from "../../../content/sections";
import { getToolingPages } from "../../../content/utils";
import { JsonLd } from "../../../lib/metadata/json-ld";
import { getListingMetadata } from "../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDItemList,
  getJsonLDOrganization,
  getJsonLDSectionBreadcrumb,
} from "../../../lib/metadata/structured-data";
import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
  ContentBoxUrl,
} from "../content-box";

export const metadata: Metadata = getListingMetadata(sections.tooling);

export default function ToolingListPage() {
  const pages = getToolingPages();
  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDSectionBreadcrumb(sections.tooling),
    getJsonLDItemList(pages, "/tooling"),
  ]);
  return (
    <section className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1>{sections.tooling.label}</h1>
      <components.Grid cols={2}>
        {pages.map((page) => (
          <ContentBoxLink key={page.slug} href={`/tooling/${page.slug}`}>
            <ContentBoxTitle>{page.metadata.title}</ContentBoxTitle>
            <ContentBoxDescription>
              {page.metadata.description}
            </ContentBoxDescription>
            <ContentBoxUrl url="Read more" />
          </ContentBoxLink>
        ))}
      </components.Grid>
    </section>
  );
}
