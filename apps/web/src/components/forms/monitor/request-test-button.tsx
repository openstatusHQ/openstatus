"use client";

import { Check, ChevronsUpDown, Send } from "lucide-react";
import React from "react";
import type { UseFormReturn } from "react-hook-form";

import { deserialize } from "@openstatus/assertions";
import type { InsertMonitor } from "@openstatus/db/src/schema";
import {
  type MonitorFlyRegion,
  flyRegions,
} from "@openstatus/db/src/schema/constants";
import {
  Button,
  type ButtonProps,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";
import { flyRegionsDict } from "@openstatus/utils";

import { LoadingAnimation } from "@/components/loading-animation";
import { RegionInfo } from "@/components/ping-response-analysis/region-info";
import { ResponseDetailTabs } from "@/components/ping-response-analysis/response-detail-tabs";
import type { RegionChecker } from "@/components/ping-response-analysis/utils";
import { toast, toastAction } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import { getLimit } from "@openstatus/db/src/schema/plan/utils";

interface Props {
  form: UseFormReturn<InsertMonitor>;
  limits: Limits;
  pingEndpoint(
    region?: MonitorFlyRegion,
  ): Promise<{ data?: RegionChecker; error?: string }>;
  onDismiss?: () => void;
  size?: ButtonProps["size"];
}

export function RequestTestButton({
  form,
  pingEndpoint,
  limits,
  onDismiss,
  size,
}: Props) {
  const [check, setCheck] = React.useState<
    { data: RegionChecker; error?: string } | undefined
  >();
  const [value, setValue] = React.useState<MonitorFlyRegion | undefined>(
    flyRegions[0],
  );
  const [isPending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const onClick = () => {
    if (isPending) return;

    const { url } = form.getValues();

    if (!url) {
      toastAction("test-warning-empty-url");
      return;
    }

    startTransition(async () => {
      try {
        const { data, error } = await pingEndpoint(value);
        if (data) setCheck({ data, error });
        const isOk = !error;
        if (isOk) {
          toastAction("test-success");
        } else {
          toast.error(error);
        }
      } catch {
        toastAction("error");
      }
    });
  };

  const { flag, location, code } =
    flyRegionsDict[value as keyof typeof flyRegionsDict];

  const { statusAssertions, headerAssertions } = form.getValues();

  const regions = getLimit(limits, "regions");

  return (
    <Dialog
      open={!!check}
      onOpenChange={() => {
        setCheck(undefined);
        onDismiss?.();
      }}
    >
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[250px] justify-between"
              size={size}
            >
              {value ? (
                <span className="flex items-center gap-2 truncate">
                  <span className="font-mono">{code}</span>
                  <span>{flag}</span>
                  <span className="truncate text-muted-foreground font-normal">
                    {location}
                  </span>
                </span>
              ) : (
                "Select region..."
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search region..." />
              <CommandList>
                <CommandEmpty>No region found.</CommandEmpty>
                <CommandGroup>
                  {regions.map((region) => {
                    const { flag, code, location } = flyRegionsDict[region];
                    return (
                      <CommandItem
                        key={region}
                        value={region}
                        onSelect={(currentValue) => {
                          const curr = currentValue as MonitorFlyRegion;
                          setValue(curr === value ? undefined : curr);
                          setOpen(false);
                        }}
                        keywords={[flag, code, location]}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === region ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="flex items-center gap-2 truncate">
                          <span className="font-mono">{code}</span>
                          <span>{flag}</span>
                          <span className="truncate text-muted-foreground font-normal">
                            {location}
                          </span>
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onClick} disabled={isPending} size={size}>
                {isPending ? (
                  <LoadingAnimation />
                ) : (
                  <>
                    Ping <Send className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Test your endpoint</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <DialogContent className="max-h-screen w-full overflow-auto sm:max-w-3xl sm:p-8">
        <DialogHeader>
          <DialogTitle>Response</DialogTitle>
        </DialogHeader>
        {check ? (
          <div className="grid gap-8 overflow-hidden">
            <RegionInfo check={check.data} error={check.error} />
            {check.data.type === "http" ? (
              <ResponseDetailTabs
                timing={check.data.timing}
                headers={check.data.headers}
                status={check.data.status}
                assertions={deserialize(
                  JSON.stringify([
                    ...(statusAssertions || []),
                    ...(headerAssertions || []),
                  ]),
                )}
                hideInfo={false}
              />
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
