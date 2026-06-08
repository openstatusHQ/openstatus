import Link from "next/link";

import { CmdK } from "./cmdk";
import { LogoWithContextMenu } from "./logo-with-context-menu";

export function DocsHeader() {
  return (
    <header className="border-border bg-border [&>*]:bg-background [&>*]:hover:bg-muted grid grid-cols-3 gap-px border font-mono lg:grid-cols-5 [&>*]:px-4 [&>*]:py-4">
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
