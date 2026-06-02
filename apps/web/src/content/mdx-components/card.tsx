import { cn } from "@/lib/utils";
import Link from "next/link";
import type React from "react";

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="my-4 grid gap-4 sm:grid-cols-2">{children}</div>;
}

export function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="[&>*:last-child]:!mb-0 border border-border p-4">
      {title ? (
        <p className="!mt-0 mb-2 font-medium text-foreground">{title}</p>
      ) : null}
      {children}
    </div>
  );
}

export function LinkCard({
  title,
  href,
  description,
}: {
  title: string;
  href: string;
  description?: string;
}) {
  const isExternal = href.startsWith("http");
  return (
    <Link
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className={cn(
        "no-underline! my-4 block border border-border p-4 hover:bg-muted",
      )}
    >
      <span className="block font-medium text-foreground">{title}</span>
      {description ? (
        <span className="mt-1 block text-muted-foreground text-sm">
          {description}
        </span>
      ) : null}
    </Link>
  );
}
