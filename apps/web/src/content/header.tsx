import { headerLinks } from "@/data/content";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import Link from "next/link";
import { CmdK } from "./cmdk";
import { LogoWithContextMenu } from "./logo-with-context-menu";

export function Header() {
  return (
    <header className="grid grid-cols-3 gap-px border border-border bg-border lg:grid-cols-6 [&>*]:bg-background [&>*]:px-4 [&>*]:py-4 [&>*]:hover:bg-muted">
      <LogoWithContextMenu />
      {headerLinks.map((section, _) => (
        <DropdownMenu key={section.label}>
          <DropdownMenuTrigger className="group flex items-center gap-1 data-[state=open]:bg-muted">
            <span className="w-full truncate text-left">{section.label}</span>
            <span
              className="relative top-[1px] shrink-0 origin-center text-[10px] text-muted-foreground transition duration-300 group-hover:text-foreground group-data-[state=open]:rotate-180 group-data-[state=open]:text-foreground"
              aria-hidden="true"
            >
              ▲
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-[var(--radix-dropdown-menu-trigger-width)] rounded-none"
            alignOffset={0}
            sideOffset={0}
          >
            {section.items.map((item) => (
              <DropdownMenuItem
                key={item.href}
                className="rounded-none px-2 py-3 font-mono"
                asChild
              >
                <Link href={item.href}>{item.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
      <Link href="/pricing" className="truncate">
        Pricing
      </Link>
      <CmdK />
      <Link
        href="https://app.openstatus.dev/login"
        className="truncate text-info"
      >
        Dashboard
      </Link>
    </header>
  );
}
