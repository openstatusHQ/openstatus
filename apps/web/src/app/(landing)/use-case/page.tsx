import { getUseCasePages } from "@/content/utils";
import { defaultMetadata, ogMetadata } from "@/lib/metadata/shared-metadata";
import { twitterMetadata } from "@/lib/metadata/shared-metadata";
import type { Metadata } from "next";
import { ContentList } from "../content-list";

const TITLE = "Use Cases";
const DESCRIPTION =
  "Discover how teams use OpenStatus for compliance, open-source projects, crypto exchanges, and API infrastructure.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/use-case",
  },
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

export default function UseCaseListPage() {
  const allUseCases = getUseCasePages();
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>Use Cases</h1>
      <ContentList data={allUseCases} prefix="/use-case" withCategory />
    </div>
  );
}
