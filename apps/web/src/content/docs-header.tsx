import Link from "next/link";
import { CmdK } from "./cmdk";
import { LogoWithContextMenu } from "./logo-with-context-menu";

export function DocsHeader() {
  return (
    <header className="grid grid-cols-3 gap-px border border-border bg-border font-mono lg:grid-cols-5 [&>*]:bg-background [&>*]:px-4 [&>*]:py-4 [&>*]:hover:bg-muted">
      <LogoWithContextMenu />
      <CmdK className="lg:col-span-3" defaultPage="docs" />
      <Link
        href="https://app.openstatus.dev/login"
        className="truncate text-blue-700 dark:text-blue-400"
      >
        Dashboard
      </Link>
    </header>
  );
}
