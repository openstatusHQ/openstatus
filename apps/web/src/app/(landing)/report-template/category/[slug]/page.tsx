import { ContentCategory } from "@/app/(landing)/content-category";
import { ContentList } from "@/app/(landing)/content-list";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { getReportTemplates } from "@/content/utils";
import type { Metadata } from "next";

const TITLE = "Report Template Category";
const DESCRIPTION = "All the latest templates from openstatus.";

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

export const dynamicParams = false;

export async function generateStaticParams() {
  const posts = getReportTemplates();
  const categories = [...new Set(posts.map((post) => post.metadata.category))];

  return categories.map((category) => ({
    slug: category.toLowerCase(),
  }));
}

export default async function ReportTemplateCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const allReportTemplates = getReportTemplates();
  const filteredReportTemplates = allReportTemplates.filter(
    (post) => post.metadata.category.toLowerCase() === slug.toLowerCase(),
  );

  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1 className="capitalize">Report Template | {slug}</h1>
      <ContentCategory data={allReportTemplates} prefix="/report-template" />
      <ContentList data={filteredReportTemplates} prefix="/report-template" />
    </div>
  );
}
