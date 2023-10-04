"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";

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
        <Button size="icon" variant="outline" className="rounded-full">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-left">Navigation</SheetTitle>
        </SheetHeader>
        <ul className="mt-4 grid gap-1">
          {pages.map(({ href, title }) => {
            const isActive = pathname?.startsWith(href);
            return (
              <li key="title" className="w-full">
                <Link
                  href={href}
                  className={cn(
                    "hover:bg-muted/50 hover:text-foreground text-muted-foreground group flex w-full min-w-[200px] items-center rounded-md border border-transparent px-3 py-1",
                    isActive && "bg-muted/50 border-border text-foreground",
                  )}
                >
                  {title}
                </Link>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
