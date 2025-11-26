import { notFound } from "next/navigation";
import { CustomMDX } from "@/content/mdx";
import { getComparePages } from "@/content/utils";

export async function generateStaticParams() {
  const posts = getComparePages();

  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function Blog({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getComparePages().find((post) => post.slug === slug);

  if (!post) {
    notFound();
  }

  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>{post.metadata.title}</h1>
      <p className="text-lg">{post.metadata.description}</p>
      <CustomMDX source={post.content} />
    </section>
  );
}
