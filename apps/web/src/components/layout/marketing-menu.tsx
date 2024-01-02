"use client";

import * as React from "react";
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

import { AppLink } from "./app-link";

const pages = [
  { href: "/changelog", label: "Changelog", segment: "changelog" },
  { href: "/blog", label: "Blog", segment: "blog" },
  { href: "https://docs.openstatus.dev", label: "Documentation" },
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
      <SheetContent side="bottom" className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="ml-2 text-left">Menu</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col justify-between gap-4">
          <ul className="grid gap-1">
            {pages.map(({ href, label, segment }) => {
              const isExternal = href.startsWith("http");
              const externalProps = isExternal ? { target: "_blank" } : {};
              return (
                <li key={href} className="w-full">
                  <AppLink
                    href={href}
                    label={label}
                    segment={segment}
                    {...externalProps}
                  />
                </li>
              );
            })}
          </ul>
          <ul className="grid gap-1">
            <li className="w-full">
              <AppLink href="/github" label="GitHub" icon="github" />
            </li>
            <li className="w-full">
              <AppLink href="/discord" label="Discord" icon="discord" />
            </li>
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
