"use client";

import { WorkspaceSwitcher } from "@/components/nav/workspace-switcher";
import { Button } from "@openstatus/ui/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

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
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              onClick={router.back}
              className="cursor-pointer"
            >
              Go Back
            </Button>
            <Button asChild>
              <Link href="/overview">Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
