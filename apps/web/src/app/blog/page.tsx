import Link from "next/link";
import { allPosts } from "contentlayer/generated";

import { BackButton } from "@/components/layout/back-button";
import { Footer } from "@/components/layout/footer";
import { getDisplayPosts } from "@/lib/contentlayer/utils";

export default async function Post() {
  const posts = await getDisplayPosts(allPosts);

  return (
    <main className="mx-5 mb-7 flex flex-col items-start pt-24 sm:mx-20 md:mx-32 md:pt-28 lg:mx-60 xl:mx-96">
      <h1 className="text-foreground font-cal mb-4 mt-2 text-5xl">Blog</h1>
      <BackButton />

      {/* All posts */}
      <section className="mb-8 ">
        {posts.map((Post, idx) => (
          <div key={Post.slug} className="mt-10">
            <Link
              href={`/blog/${Post.slug}`}
              className="text-foreground font-cal text-2xl"
            >
              <span>{idx + 1}. </span>
              {Post.title}
            </Link>
            <p className="text-muted-foreground text-base">
              {Post.description}
            </p>

            <div className="text-muted-foreground mt-2 flex flex-row justify-start gap-5 text-sm">
              <Link href={Post.authorLink} className="hidden sm:inline">
                {Post.author}
              </Link>
              <span className="hidden sm:inline">/</span>
              <p>{Post.publishedAtFormatted}</p>
              <span>/</span>
              <p>{Post.readingTime}</p>
            </div>
          </div>
        ))}
      </section>
      <Footer />
    </main>
  );
}
