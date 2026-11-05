import type { Metadata } from "next";

import { sections } from "../../../content/sections";
import { getGuides } from "../../../content/utils";
import { JsonLd } from "../../../lib/metadata/json-ld";
import { getListingMetadata } from "../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDItemList,
  getJsonLDOrganization,
  getJsonLDSectionBreadcrumb,
} from "../../../lib/metadata/structured-data";
import { ContentCategory } from "../content-category";
import { ContentList } from "../content-list";

export const metadata: Metadata = getListingMetadata(sections.guides);

export default function GuidesListPage() {
  const allGuides = getGuides();
  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDSectionBreadcrumb(sections.guides),
    getJsonLDItemList(allGuides, "/guides"),
  ]);
  return (
    <div className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1>Guides</h1>
      <ContentCategory data={allGuides} prefix="/guides" />
      <ContentList data={allGuides} prefix="/guides" withCategory />
    </div>
  );
}
