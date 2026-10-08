"use client";

import { Docs } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { usePathname } from "next/navigation";

import { NavFeedback } from "@/components/nav/nav-feedback";

import { AGENT_TABS } from "./constants";

export function NavActions() {
  const pathname = usePathname();
  const segment = pathname.split("/").pop() ?? "";
  const currentTab = AGENT_TABS.find((tab) => tab.value === segment);
  const docs = currentTab?.docs ?? "https://www.openstatus.dev/docs";

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="group h-7 w-7" asChild>
              <a href={docs} target="_blank" rel="noreferrer">
                <Docs className="text-muted-foreground group-hover:text-foreground h-4 w-4" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>View Documentation</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
