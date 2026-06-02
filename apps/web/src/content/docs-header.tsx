import Link from "next/link";
import { CmdK } from "./cmdk";
import { LogoWithContextMenu } from "./logo-with-context-menu";

export function DocsHeader() {
  return (
    <header className="grid grid-cols-3 gap-px border border-border bg-border md:grid-cols-6 [&>*]:bg-background [&>*]:px-4 [&>*]:py-4 [&>*]:hover:bg-muted">
      <LogoWithContextMenu />
      <div
        aria-hidden
        className="pointer-events-none hidden md:col-span-3 md:block"
      />
      <CmdK />
      <Link
        href="https://app.openstatus.dev/login"
        className="truncate text-blue-700 dark:text-blue-400"
      >
        Dashboard
      </Link>
    </header>
  );
}
