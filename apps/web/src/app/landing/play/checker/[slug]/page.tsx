import { CustomMDX } from "@/content/mdx";
import { getToolsPage } from "@/content/utils";
import { Table } from "./client";

// just random to have one
export async function generateStaticParams() {
  return [{ slug: "1" }];
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getToolsPage("checker-slug");
  console.log({ slug });
  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>{page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <Table />
      <CustomMDX source={page.content} />
    </section>
  );
}
