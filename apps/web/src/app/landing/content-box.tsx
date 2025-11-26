import { cn } from "@/lib/utils";
import Link from "next/link";
import type React from "react";

export function ContentBoxLink({
  href,
  children,
  className,
  target,
  rel,
  ...props
}: React.ComponentProps<typeof Link>) {
  const hrefString = typeof href === "string" ? href : href.toString();
  const isExternal = hrefString.startsWith("http");

  return (
    <Link
      href={href}
      target={target ?? (isExternal ? "_blank" : undefined)}
      rel={rel ?? (isExternal ? "noopener noreferrer" : undefined)}
      className={cn("group no-underline! hover:bg-muted", className)}
      {...props}
    >
      {children}
    </Link>
  );
}

export function ContentBoxTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p className={cn(className)} {...props}>
      <strong>{children}</strong>
    </p>
  );
}

export function ContentBoxDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-muted-foreground", className)} {...props}>
      {children}
    </p>
  );
}

export function ContentBoxUrl({
  url,
  className,
  ...props
}: {
  url: string;
  className?: string;
} & Omit<React.ComponentProps<"div">, "children">) {
  const displayUrl = url.replace(/^https:\/\/(www\.)?/, "");

  return (
    <div
      className={cn(
        "underline decoration-2 decoration-muted-foreground/50 underline-offset-2 transition-all group-hover:decoration-muted-foreground",
        className,
      )}
      {...props}
    >
      {displayUrl}
    </div>
  );
}
