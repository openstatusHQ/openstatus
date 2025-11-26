import { CustomMDX } from "@/content/mdx";
import { formatDate, getChangelogPosts } from "@/content/utils";
import { notFound } from "next/navigation";

const baseUrl = "http://localhost:3000";

export async function generateStaticParams() {
  const posts = getChangelogPosts();

  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getChangelogPosts().find((post) => post.slug === slug);
  if (!post) {
    return;
  }

  const {
    title,
    publishedAt: publishedTime,
    description,
    image,
  } = post.metadata;
  const ogImage = image
    ? image
    : `${baseUrl}/og?title=${encodeURIComponent(title)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime,
      url: `${baseUrl}/changelog/${post.slug}`,
      images: [
        {
          url: ogImage,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function Changelog({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getChangelogPosts().find((post) => post.slug === slug);

  if (!post) {
    notFound();
  }

  return (
    <section className="prose dark:prose-invert max-w-none">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.metadata.title,
            datePublished: post.metadata.publishedAt,
            dateModified: post.metadata.publishedAt,
            description: post.metadata.description,
            image: post.metadata.image
              ? `${baseUrl}${post.metadata.image}`
              : `/og?title=${encodeURIComponent(post.metadata.title)}`,
            url: `${baseUrl}/changelog/${post.slug}`,
            author: {
              "@type": "Person",
              name: "Maximilian Kaske",
            },
          }),
        }}
      />
      <h1>{post.metadata.title}</h1>
      <p className="flex items-center gap-2.5 divide-x divide-border text-muted-foreground">
        {formatDate(post.metadata.publishedAt)} | by {post.metadata.author} | [
        {post.metadata.category}]
      </p>
      <CustomMDX source={post.content} />
    </section>
  );
}
