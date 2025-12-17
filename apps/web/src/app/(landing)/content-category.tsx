import type { MDXData } from "@/content/utils";
import Link from "next/link";
import { Fragment } from "react";

export function ContentCategory({
  data,
  prefix,
}: {
  data: MDXData[];
  prefix: string;
}) {
  const categories = [...new Set(data.map((page) => page.metadata.category))];
  return (
    <p>
      <Link href={prefix}>All</Link>
      <span className="text-muted-foreground">{" | "}</span>
      {categories.map((category, index) => (
        <Fragment key={category}>
          <Link
            href={`${prefix}/category/${category.toLowerCase()}`}
            className="capitalize"
          >
            {category}
          </Link>
          {index < categories.length - 1 ? <span>{" | "}</span> : null}
        </Fragment>
      ))}
    </p>
  );
}
