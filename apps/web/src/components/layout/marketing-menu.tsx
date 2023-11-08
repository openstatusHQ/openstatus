"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowUpRight, Menu } from "lucide-react";

import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@openstatus/ui";

import { cn } from "@/lib/utils";

const pages = [
  { href: "/changelog", title: "Changelog" },
  { href: "/blog", title: "Blog" },
  { href: "https://docs.openstatus.dev", title: "Docs" },
];

export function MarketingMenu() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname, searchParams]); // remove searchParams if not needed

  return (
    <Sheet open={open} onOpenChange={(value) => setOpen(value)}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="rounded-full"
          aria-label="menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="ml-2 text-left">Menu</SheetTitle>
        </SheetHeader>
        <ul className="mt-4 grid gap-1">
          {pages.map(({ href, title }) => {
            const isActive = pathname?.startsWith(href);
            const isExternal = href.startsWith("http");
            const externalProps = isExternal
              ? {
                  target: "_blank",
                  rel: "noreferrer",
                }
              : {};
            return (
              <li key={href} className="-ml-1 w-full">
                <Link
                  href={href}
                  className={cn(
                    "hover:bg-muted/50 hover:text-foreground text-muted-foreground group inline-flex w-full min-w-[200px] items-center rounded-md border border-transparent px-3 py-1",
                    isActive && "bg-muted/50 border-border text-foreground",
                  )}
                  {...externalProps}
                >
                  {title}
                  {isExternal ? (
                    <ArrowUpRight className="ml-1 h-4 w-4 flex-shrink-0" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
