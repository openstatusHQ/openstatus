import { CustomMDX } from "@/content/mdx";
import { getMainPages } from "@/content/utils";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  const pages = getMainPages();

  return pages.map((page) => ({
    slug: page.slug,
  }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getMainPages().find((page) => page.slug === slug);

  if (!page) {
    notFound();
  }

  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>{page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <CustomMDX source={page.content} />
    </section>
  );
}
