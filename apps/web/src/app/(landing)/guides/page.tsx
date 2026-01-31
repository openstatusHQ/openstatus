import { getGuides } from "@/content/utils";
import { defaultMetadata, ogMetadata } from "@/lib/metadata/shared-metadata";
import { twitterMetadata } from "@/lib/metadata/shared-metadata";
import type { Metadata } from "next";
import { ContentCategory } from "../content-category";
import { ContentList } from "../content-list";

const TITLE = "Guides";
const DESCRIPTION = "All the latest guides from openstatus.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    ...ogMetadata,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    ...twitterMetadata,
    title: TITLE,
    description: DESCRIPTION,
    images: [`/api/og?title=${TITLE}&description=${DESCRIPTION}`],
  },
};

export default function GuidesListPage() {
  const allGuides = getGuides();
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>Guides</h1>
      <ContentCategory data={allGuides} prefix="/guides" />
      <ContentList data={allGuides} prefix="/guides" withCategory />
    </div>
  );
}
