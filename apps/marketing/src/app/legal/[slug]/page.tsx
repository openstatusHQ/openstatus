import { allLegals } from "content-collections";
import { notFound } from "next/navigation";

import { Mdx } from "@/components/content/mdx";
import { BackButton } from "@/components/layout/back-button";
import { Shell } from "@openstatus/ui";

// export const dynamic = "force-static";

export async function generateStaticParams() {
  return allLegals.map((post) => ({
    slug: post.slug,
  }));
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const post = allLegals.find((post) => post.slug === params.slug);

  if (!post) {
    notFound();
  }

  // TODO: add author.avatar and author.url
  return (
    <>
      <BackButton href="/" />
      <Shell className="sm:py-8 md:py-12">
        <article className="grid gap-8">
          <div className="mx-auto grid w-full max-w-prose gap-3">
            <h1 className="mb-5 font-cal text-3xl">{post.title}</h1>
          </div>
          <div className="mx-auto max-w-prose">
            <Mdx code={post.mdx} />
          </div>
        </article>
      </Shell>
    </>
  );
}
