import type { Metadata } from "next";

import { sections } from "../../../content/sections";
import { getUseCasePages } from "../../../content/utils";
import { JsonLd } from "../../../lib/metadata/json-ld";
import { getListingMetadata } from "../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDItemList,
  getJsonLDOrganization,
  getJsonLDSectionBreadcrumb,
} from "../../../lib/metadata/structured-data";
import { ContentList } from "../content-list";

export const metadata: Metadata = getListingMetadata(sections["use-case"]);

export default function UseCaseListPage() {
  const allUseCases = getUseCasePages();
  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDSectionBreadcrumb(sections["use-case"]),
    getJsonLDItemList(allUseCases, "/use-case"),
  ]);
  return (
    <div className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1>Use Cases</h1>
      <ContentList data={allUseCases} prefix="/use-case" withCategory />
    </div>
  );
}
