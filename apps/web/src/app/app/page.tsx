"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Shell } from "@/components/dashboard/shell";
import { LoadingAnimation } from "@/components/loading-animation";

// TODO: discuss how to make that page a bit more enjoyable
export default function Page() {
  const router = useRouter();

  // waiting for the workspace to be created
  setTimeout(() => router.refresh(), 1000);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <Shell className="mx-auto grid w-auto gap-4">
        <div className="grid gap-1 text-center">
          <p className="text-lg font-bold">Creating Workspace</p>
          <p className="text-muted-foreground">Should be done in a second.</p>
        </div>
        <LoadingAnimation variant="inverse" size="lg" />
      </Shell>
    </div>
  );
}
