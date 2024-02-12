"use client";

import Link from "next/link";
import { useParams, useSelectedLayoutSegment } from "next/navigation";

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { pagesConfig } from "@/config/pages";

export function AppSidebar() {
  const params = useParams();
  const selectedSegment = useSelectedLayoutSegment();

  return (
    <ul className="grid gap-3">
      {pagesConfig.map(({ title, href, icon, segment }) => {
        const Icon = Icons[icon];
        const active = segment === selectedSegment;
        return (
          <li key={title} className="w-full">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={active ? "secondary" : "outline"}
                    size="icon"
                    className="border"
                  >
                    <Link href={`/app/${params?.workspaceSlug}${href}`}>
                      <Icon className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>{title}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </li>
        );
      })}
    </ul>
  );
}
