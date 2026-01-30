import { defaultMetadata, ogMetadata } from "@/app/shared-metadata";
import { twitterMetadata } from "@/app/shared-metadata";
import { getReportTemplates } from "@/content/utils";
import type { Metadata } from "next";
import { ContentCategory } from "../content-category";
import { ContentList } from "../content-list";

const TITLE = "Report Template";
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

export default function ReportTemplateListPage() {
  const allReportTemplates = getReportTemplates();
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>Report Templates</h1>
      <ContentCategory data={allReportTemplates} prefix="/report-template" />
      <ContentList
        data={allReportTemplates}
        prefix="/report-template"
        withCategory
      />
    </div>
  );
}
