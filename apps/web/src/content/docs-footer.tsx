import { FooterStatus } from "./footer-status";
import { Link } from "./link";
import { ThemeToggle } from "./theme-toggle";

export function DocsFooter() {
  return (
    <footer className="font-mono">
      <div className="border-border bg-border [&>*]:bg-background grid gap-px border bg-clip-padding sm:grid-cols-2 md:grid-cols-3">
        <Link
          href="/cal"
          className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2"
        >
          Talk to the founders
        </Link>
        <div>
          <FooterStatus />
        </div>
        <div className="sm:col-span-2 md:col-span-1">
          <ThemeToggle className="rounded-none" />
        </div>
      </div>
    </footer>
  );
}
