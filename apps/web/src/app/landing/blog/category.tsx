import Link from "next/link";
import { Fragment } from "react";
import { getBlogPosts } from "@/content/utils";

const allBlogs = getBlogPosts();
const categories = [...new Set(allBlogs.map((blog) => blog.metadata.category))];

export function BlogCategory() {
  return (
    <p>
      <Link href="/landing/blog">All</Link>
      <span>{" | "}</span>
      {categories.map((category, index) => (
        <Fragment key={category}>
          <Link href={`/landing/blog/category/${category.toLowerCase()}`}>
            {category}
          </Link>
          {index < categories.length - 1 ? <span>{" | "}</span> : null}
        </Fragment>
      ))}
    </p>
  );
}
