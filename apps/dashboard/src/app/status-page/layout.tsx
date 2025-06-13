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
    <div className="min-h-screen flex flex-col gap-4">
      <header className="w-full border-b border px-3 py-2">
        <nav className="max-w-xl mx-auto flex items-center justify-between">
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
      <main className="max-w-xl w-full mx-auto flex-1 px-3 py-2">
        {children}
      </main>
      <footer className="w-full border-t border px-3 py-2">
        <div className="max-w-xl mx-auto">
          <p className="text-center text-muted-foreground">
            Powered by <Link href="#">OpenStatus</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
