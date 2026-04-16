import { WorkspaceSwitcher } from "@/components/nav/workspace-switcher";
import { Activity, Cog, LayoutGrid, PanelTop } from "lucide-react";
import Link from "next/link";

const quickLinks = [
  { name: "Overview", href: "/overview", icon: LayoutGrid },
  { name: "Monitors", href: "/monitors", icon: Activity },
  { name: "Status Pages", href: "/status-pages", icon: PanelTop },
  { name: "Settings", href: "/settings/general", icon: Cog },
];

export default function NotFound() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 md:p-8">
      <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-sidebar">
        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex flex-col gap-1 text-center">
            <p className="font-mono text-destructive">404 Not found</p>
            <h2 className="font-cal text-2xl text-foreground">
              Page not found
            </h2>
            <p className="text-muted-foreground text-sm">
              This resource doesn&apos;t exist or you might not be in the right
              workspace.
            </p>
          </div>
          <WorkspaceSwitcher
            className="rounded-md border border-border bg-background"
            side="bottom"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 font-commit-mono text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <link.icon className="h-4 w-4" />
                {link.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
