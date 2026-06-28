import { FooterStatus } from "./footer-status";
import { Link } from "./link";
import { ThemeToggle } from "./theme-toggle";

export function DocsFooter() {
  return (
    <footer className="font-mono">
      <div className="border-border bg-border [&>*]:bg-background grid gap-px border sm:grid-cols-2 md:grid-cols-3">
        <Link
          href="/cal"
          className="hover:bg-muted flex w-full items-center gap-2 p-4"
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
