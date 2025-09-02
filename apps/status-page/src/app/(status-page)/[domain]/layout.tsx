"use client";

/**
 * TODO:
 * - add different header
 * - add different chart/tracker
 * - add subscription popover (choose which one you'd like to allow)
 * - use the '@/components/status-page` for the components
 */

import { Link } from "@/components/common/link";
import {
  FloatingButton,
  StatusPageProvider,
} from "@/components/status-page/floating-button";
import { StatusUpdates } from "@/components/status-page/status-updates";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
const nav = [
  { label: "Status", href: "/status-page" },
  { label: "Events", href: "/status-page/events" },
  { label: "Monitors", href: "/status-page/monitors" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <StatusPageProvider>
      <div className="flex min-h-screen flex-col gap-4">
        <header className="w-full border-b">
          <nav className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-3 py-2">
            {/* NOTE: same width as the `StatusUpdates` button */}
            <div className="w-[105px] shrink-0">
              <Link href="/">
                <img
                  src="https://www.openstatus.dev/icon.png"
                  alt="Craft"
                  className="size-8 rounded-full border"
                />
              </Link>
            </div>
            <NavDesktop className="hidden md:flex" />
            <StatusUpdates className="hidden md:block" />
            <div className="flex gap-3 md:hidden">
              <NavMobile />
              <StatusUpdates />
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-3 py-2">
          {children}
        </main>
        <footer className="w-full border-t">
          <div className="mx-auto max-w-2xl px-3 py-2">
            <p className="text-center text-muted-foreground">
              Powered by <Link href="#">OpenStatus</Link>
            </p>
          </div>
        </footer>
      </div>
      <FloatingButton />
    </StatusPageProvider>
  );
}

function NavDesktop({ className, ...props }: React.ComponentProps<"ul">) {
  const pathname = usePathname();
  return (
    <ul className={cn("flex flex-row gap-2", className)} {...props}>
      {nav.map((item) => {
        const isActive =
          item.href === "/status-page"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <li key={item.label}>
            <Button
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              asChild
            >
              <NextLink href={item.href}>{item.label}</NextLink>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function NavMobile({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className={cn("size-8", className)}
          {...props}
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="top">
        <SheetHeader className="border-b">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div className="px-1 pb-4">
          <ul className="flex flex-col gap-1">
            {nav.map((item) => {
              const isActive =
                item.href === "/status-page"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
              return (
                <li key={item.label} className="w-full">
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    onClick={() => setOpen(false)}
                    className="w-full justify-start"
                    size="sm"
                    asChild
                  >
                    <NextLink href={item.href}>{item.label}</NextLink>
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
