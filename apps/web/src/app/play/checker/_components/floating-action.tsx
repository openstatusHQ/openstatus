"use client";

import * as Portal from "@radix-ui/react-portal";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function FloatingAction({ id }: { id: string | null }) {
  if (!id) return null;

  return (
    <Portal.Root>
      <div className="fixed right-4 bottom-4 z-50 mx-auto w-fit px-4">
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background px-4 py-3 shadow">
          <p className="text-muted-foreground text-sm">
            Wanna learn more?{" "}
            <Link
              href={`/play/checker/${id}`}
              className="text-foreground underline underline-offset-4 hover:no-underline"
            >
              Details
              <ArrowUpRight className="ml-1 inline h-4 w-4" />
            </Link>
          </p>
        </div>
      </div>
    </Portal.Root>
  );
}
