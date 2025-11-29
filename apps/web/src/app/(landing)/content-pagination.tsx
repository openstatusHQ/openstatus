import { Link } from "@/content/link";
import type { MDXData } from "@/content/utils";

export function ContentPagination({
  previousPost,
  nextPost,
  prefix,
}: {
  previousPost?: MDXData;
  nextPost?: MDXData;
  prefix: string;
}) {
  return (
    <div className="flex items-center justify-between gap-8">
      <p className="flex-1 truncate">
        {previousPost ? (
          <Link
            href={`${prefix}/${previousPost.slug}`}
            className="max-w-40 truncate"
          >
            {previousPost.metadata.title}
          </Link>
        ) : null}
      </p>
      <p className="flex-1 truncate text-right">
        {nextPost ? (
          <Link
            href={`${prefix}/${nextPost.slug}`}
            className="max-w-40 truncate"
          >
            {nextPost.metadata.title}
          </Link>
        ) : null}
      </p>
    </div>
  );
}
