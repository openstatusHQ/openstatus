/**
 * TODO:
 * - add different header
 * - add different chart/tracker
 * - add subscription popover (choose which one you'd like to allow)
 * - use the '@/components/status-page` for the components
 */

import { Link } from "@/components/common/link";
import { Button } from "@/components/ui/button";
import NextLink from "next/link";

const nav = [
  { label: "Status", href: "#" },
  { label: "Events", href: "#" },
  { label: "Monitors", href: "#" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col gap-4">
      <header className="w-full border border-b px-3 py-2">
        <nav className="mx-auto flex max-w-xl items-center justify-between">
          <ul className="flex flex-row gap-2">
            {nav.map((item) => (
              <li key={item.label}>
                <Button variant="ghost" asChild>
                  <NextLink href={item.href}>{item.label}</NextLink>
                </Button>
              </li>
            ))}
          </ul>
          <div>{/* TODO: Popover */}</div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-3 py-2">
        {children}
      </main>
      <footer className="w-full border border-t px-3 py-2">
        <div className="mx-auto max-w-xl">
          <p className="text-center text-muted-foreground">
            Powered by <Link href="#">OpenStatus</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
