import Link from "next/link";
import { allBlogs } from "contentlayer/generated";

import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { getDisplayBlogs } from "@/lib/contentlayer";

export default async function Blog() {
  const blogs = await getDisplayBlogs(allBlogs);

  return (
    <main className="mx-5 mb-7 flex flex-col items-start pt-24 sm:mx-20 md:mx-32 md:pt-28 lg:mx-60 xl:mx-96">
      <h1 className="text-foreground font-cal mb-4 mt-2 text-5xl">Blog</h1>
      <Button variant="secondary">
        <Link href="/">⬅ Back to home</Link>
      </Button>

      {/* All blogs */}
      <section className="mb-8 ">
        {blogs.map((blog, idx) => (
          <div key={blog.slug} className="mt-10">
            <Link
              href={`/blog/${blog.slug}`}
              className="text-foreground font-cal text-2xl"
            >
              <span>{idx + 1}. </span>
              {blog.title}
            </Link>
            <p className="text-muted-foreground text-base">
              {blog.description}
            </p>

            <div className="text-muted-foreground mt-2 flex flex-row justify-start gap-5 text-sm">
              <p>{blog.publishedAtFormatted}</p>
              <p>{blog.readingTime}</p>
            </div>
          </div>
        ))}
      </section>
      <Footer />
    </main>
  );
}
