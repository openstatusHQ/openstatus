import { Button } from "@openstatus/ui/components/ui/button";
import { BookOpen } from "lucide-react";
import Image from "next/image";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      <Button
        asChild
        size="sm"
        variant="outline"
        className="absolute top-4 right-4 z-10"
      >
        <a href="https://docs.openstatus.dev" target="_blank" rel="noreferrer">
          <BookOpen className="mr-2 h-4 w-4" />
          Documentation
        </a>
      </Button>
      <aside className="col-span-1 flex w-full flex-col gap-4 border border-border bg-sidebar p-4 backdrop-blur-[2px] md:p-8 xl:col-span-2">
        <a href="https://openstatus.dev" className="relative h-8 w-8">
          <Image
            src="https://openstatus.dev/icon.png"
            alt="OpenStatus"
            height={32}
            width={32}
            className="rounded-full border border-border"
          />
        </a>
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8 text-center md:text-left">
          <div className="mx-auto grid gap-3">
            <h1 className="font-cal text-3xl text-foreground">
              Your Status Page in Minutes
            </h1>
            <p className="text-muted-foreground text-sm">
              Communicate incidents, prove compliance readiness, and monitor
              uptime from 28 global regions. Open source and free to start.{" "}
            </p>
            <p className="text-muted-foreground text-sm">
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
      <main className="container col-span-1 mx-auto flex items-center justify-center md:col-span-1 xl:col-span-3">
        {children}
      </main>
    </div>
  );
}
