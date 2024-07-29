"use client";

import { ChevronsUpDown } from "lucide-react";
import { useSelectedLayoutSegment } from "next/navigation";
import * as React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/src/components/collapsible";

import type { Page } from "@/config/pages";
import { AppSidebar } from "./app-sidebar";

export function AppMenu({ page }: { page?: Page }) {
  const [open, setOpen] = React.useState(false);

  const selectedSegment = useSelectedLayoutSegment();

  if (!page) return null;

  const activeChild = page?.children?.find(
    ({ segment }) => segment === selectedSegment,
  );

  return (
    <Collapsible open={open} onOpenChange={(value) => setOpen(value)}>
      <CollapsibleTrigger className="flex w-full items-center justify-between">
        <span className="font-medium text-foreground">
          {activeChild?.title}
        </span>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md font-medium text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
          <ChevronsUpDown className="h-4 w-4" />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <AppSidebar page={page} />
      </CollapsibleContent>
    </Collapsible>
  );
}
