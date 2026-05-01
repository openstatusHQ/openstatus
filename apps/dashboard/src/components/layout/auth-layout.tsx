import {
  SHELL_CONTENT_COLUMN,
  SHELL_FORM_COLUMN,
} from "@/components/layout/shell-columns";
import { Wordmark } from "@/components/layout/wordmark";
import { cn } from "@/lib/utils";
import { Button } from "@openstatus/ui/components/ui/button";
import { BookOpen } from "lucide-react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      <div className="absolute top-4 left-4 z-10">
        <Wordmark size={24} showText />
      </div>
      <Button
        size="sm"
        variant="outline"
        className="absolute top-4 right-4 z-10"
        asChild
      >
        <a href="https://docs.openstatus.dev" target="_blank" rel="noreferrer">
          <BookOpen />
          Documentation
        </a>
      </Button>
      {/*
        Column widths mirror onboarding: form column = `xl:col-span-2`,
        content column = `xl:col-span-3`. Both login and onboarding
        keep the form on the left, so the grids feel aligned when
        navigating between them.
      */}
      <main
        className={cn(
          "container col-span-1 mx-auto flex items-center justify-center md:col-span-1",
          SHELL_FORM_COLUMN,
        )}
      >
        {children}
      </main>
      <aside
        className={cn(
          "col-span-1 flex w-full flex-col gap-4 border border-border bg-sidebar p-4 backdrop-blur-[2px] md:p-8",
          SHELL_CONTENT_COLUMN,
        )}
      >
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 text-center md:text-left">
          <div className="mx-auto grid gap-3">
            <h1 className="font-cal text-3xl text-foreground">
              Your status page, live in minutes.
            </h1>
            <p className="font-commit-mono text-muted-foreground">
              Communicate incidents, prove uptime, and monitor every endpoint
              from 28 regions. Open source. Free to start.
            </p>
            <p className="font-commit-mono text-muted-foreground">
              Coming from{" "}
              <a
                href="https://openstatus.dev/guides/migrate-from-atlassian-statuspage"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-4 hover:no-underline"
              >
                Atlassian Statuspage
              </a>
              ,{" "}
              <a
                href="https://openstatus.dev/guides/migrate-from-betterstack"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-4 hover:no-underline"
              >
                Betterstack
              </a>
              , or{" "}
              <a
                href="https://openstatus.dev/guides/migrate-from-instatus"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-4 hover:no-underline"
              >
                Instatus
              </a>
              ? We have importers for all three.
            </p>
          </div>
        </div>
        <div className="md:h-8" />
      </aside>
    </div>
  );
}
