import { getBlogPosts } from "@/content/utils";
import Link from "next/link";
import { ContentList } from "../content-list";
import { BlogCategory } from "./category";

export default function BlogListPage() {
  const allBlogs = getBlogPosts();
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>Blog</h1>
      <BlogCategory />
      <p>
        Get the{" "}
        <Link href="https://www.openstatus.dev/blog/feed.xml" target="_blank">
          RSS feed
        </Link>
      </p>
      <ContentList data={allBlogs} prefix="/landing/blog" withCategory />
    </div>
  );
}
