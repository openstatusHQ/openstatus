import Link from "next/link";
import { CmdK } from "./cmdk";
import { LogoWithContextMenu } from "./logo-with-context-menu";

export function DocsHeader() {
  return (
    <header className="border border-border">
      <div className="flex items-stretch gap-8 px-4">
        {/* Logo — same width as sidebar (w-56) */}
        <div className="hidden w-56 shrink-0 items-center py-4 lg:flex">
          <LogoWithContextMenu />
        </div>
        <div className="flex items-center py-4 lg:hidden">
          <LogoWithContextMenu />
        </div>

        {/* Search — fills main content column */}
        <div className="flex min-w-0 flex-1 items-center border-x border-border px-4 py-4 transition-colors duration-150 ease hover:bg-muted motion-reduce:transition-none max-lg:hidden">
          <CmdK defaultPage="docs" />
        </div>
        <div className="flex items-center border-l border-border px-4 py-4 transition-colors duration-150 ease hover:bg-muted motion-reduce:transition-none lg:hidden">
          <CmdK defaultPage="docs" />
        </div>

        {/* Dashboard — same width as TOC aside (w-56), auto on smaller */}
        <Link
          href="https://app.openstatus.dev/login"
          className="hidden shrink-0 items-center py-4 text-sm text-blue-700 transition-colors duration-150 ease hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 xl:flex xl:w-56 motion-reduce:transition-none"
        >
          Dashboard
        </Link>
        <Link
          href="https://app.openstatus.dev/login"
          className="flex items-center py-4 text-sm text-blue-700 transition-colors duration-150 ease hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 xl:hidden motion-reduce:transition-none"
        >
          Dashboard
        </Link>
      </div>
    </header>
  );
}
