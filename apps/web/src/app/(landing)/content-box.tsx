import { CustomImage } from "@/content/mdx-components/custom-image";
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

export function ContentBoxContainer({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border border-border p-4",
        "[&>*:first-child]:!mt-0 [&>*:last-child]:!mb-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ContentBoxImage({
  className,
  disableZoom = true,
  ...props
}: React.ComponentProps<typeof CustomImage>) {
  return (
    <div className="-mx-4 mb-3 border-border border-b px-4 pb-3">
      <CustomImage
        disableZoom={disableZoom}
        className={cn("h-8 w-auto", className)}
        {...props}
      />
    </div>
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
