import Link from "next/link";
import type React from "react";

import { cn } from "@/lib/utils";

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
    <div className="border-border border p-4 [&>*:last-child]:!mb-0">
      {title ? (
        <p className="text-foreground !mt-0 mb-2 font-medium">{title}</p>
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
        "border-border hover:bg-muted my-4 block border p-4 no-underline!",
      )}
    >
      <span className="text-foreground block font-medium">{title}</span>
      {description ? (
        <span className="text-muted-foreground mt-1 block text-sm">
          {description}
        </span>
      ) : null}
    </Link>
  );
}
