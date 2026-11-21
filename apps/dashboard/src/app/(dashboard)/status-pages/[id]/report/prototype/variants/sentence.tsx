"use client";

import { ChevronDown } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import NextLink from "next/link";

import { Link } from "@/components/common/link";
import { FormCard } from "@/components/forms/form-card";
import { UptimeCalculation } from "@/components/status-pages/uptime-calculation";
import {
  UPTIME_DOCS_URL,
  UPTIME_MODES,
} from "@/data/uptime-calculation.client";

import { SUMMARY, type VariantProps } from "../content";

export function Sentence({ mode, configurationHref }: VariantProps) {
  const label = UPTIME_MODES.find((m) => m.value === mode)?.label;
  return (
    <FormCard id="how-uptime-is-calculated">
      <Collapsible>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
          <p className="text-muted-foreground min-w-0 flex-1">
            Uptime is <span className="text-foreground">{SUMMARY[mode]}</span>,
            using <span className="text-foreground font-medium">{label}</span>.
          </p>
          <div className="flex items-center gap-1">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="group/trigger text-muted-foreground"
              >
                Details
                <ChevronDown className="transition-transform duration-200 ease-out group-data-[state=open]/trigger:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <Button variant="outline" size="sm" asChild>
              <NextLink href={configurationHref}>Change</NextLink>
            </Button>
          </div>
        </div>
        <CollapsibleContent className="border-t">
          <div className="grid gap-4 p-4">
            <UptimeCalculation mode={mode} />
            <p className="text-muted-foreground text-sm">
              <Link href={UPTIME_DOCS_URL}>Read the full explanation</Link>
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </FormCard>
  );
}
