import { mockCheckAllRegions } from "@/app/(pages)/(content)/play/checker/api/mock";
import { getPageMetadata } from "@/app/shared-metadata";
import { getCheckerDataById } from "@/components/ping-response-analysis/utils";
import { CustomMDX } from "@/content/mdx";
import { getToolsPage } from "@/content/utils";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Table } from "./client";

export function generateMetadata(): Metadata {
  const page = getToolsPage("checker-slug");
  return getPageMetadata(page);
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getToolsPage("checker-slug");

  const data =
    process.env.NODE_ENV === "development"
      ? await mockCheckAllRegions()
      : await getCheckerDataById(slug);

  if (!data) redirect("/landing/play/checker");

  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>{page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <Table data={data} />
      <CustomMDX source={page.content} />
    </section>
  );
}
