"use client";

import Link from "next/link";
import { usePathname, useSelectedLayoutSegment } from "next/navigation";

import { Button } from "@/components/ui/button";

export default function NavigationLink({
  slug,
  children,
}: {
  slug: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const segment = useSelectedLayoutSegment();
  const isActive = slug === segment;

  // REMINDER: `/status-page/${params.domain}/${slug}` won't work for subdomain
  let href = pathname || "";

  if (!isActive) {
    if (segment && slug) {
      href = `${pathname?.replace(segment, slug)}`;
    } else if (segment) {
      href = `${pathname?.replace(segment, "")}`;
    } else {
      href = `${pathname}${pathname?.endsWith("/") ? "" : "/"}${slug}`;
    }
  }

  return (
    <Button
      asChild
      variant={isActive ? "secondary" : "ghost"}
      className={isActive ? "font-bold" : ""}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}
