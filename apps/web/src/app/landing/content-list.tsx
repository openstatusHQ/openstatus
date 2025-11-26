import Link from "next/link";
import { formatDate, type MDXData } from "@/content/utils";
import { cn } from "@/lib/utils";

export function ContentList({
  data,
  prefix,
  withCategory = false,
}: {
  data: MDXData[];
  prefix: string;
  withCategory?: boolean;
}) {
  return (
    <ContentListContainer>
      {data
        .sort((a, b) => {
          if (
            new Date(a.metadata.publishedAt) > new Date(b.metadata.publishedAt)
          ) {
            return -1;
          }
          return 1;
        })
        .map((post) => (
          <ContentListLink key={post.slug} href={`${prefix}/${post.slug}`}>
            <ContentListItem>
              <ContentListItemDate>
                {formatDate(post.metadata.publishedAt, false)}
              </ContentListItemDate>
              <ContentListItemTitle>{post.metadata.title}</ContentListItemTitle>
              {withCategory ? (
                <span className="text-muted-foreground">
                  [{post.metadata.category}]
                </span>
              ) : null}
            </ContentListItem>
          </ContentListLink>
        ))}
    </ContentListContainer>
  );
}

export function ContentListContainer({
  children,
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("prose dark:prose-invert max-w-none", className)}
      {...props}
    >
      <div>{children}</div>
    </section>
  );
}

export function ContentListItem({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full flex-col space-x-0 md:flex-row md:space-x-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ContentListLink({
  href,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      className={cn("no-underline! flex flex-col hover:bg-muted", className)}
      {...props}
    >
      {children}
    </Link>
  );
}

export function ContentListItemTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-foreground tracking-tight", className)}
      {...props}
    >
      {children}
    </span>
  );
}

export function ContentListItemDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span className={cn("text-muted-foreground", className)} {...props}>
      {children}
    </span>
  );
}

export function ContentListItemDate({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground tabular-nums", className)}
      {...props}
    >
      {children}
    </span>
  );
}
