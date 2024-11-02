"use client";

import { Send } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import { getLimit } from "@openstatus/db/src/schema/plan/utils";

interface Props {
  form: UseFormReturn<InsertMonitor>;
  limits: Limits;
  pingEndpoint(
    region?: MonitorFlyRegion,
  ): Promise<{ data?: RegionChecker; error?: string }>;
}

export function RequestTestButton({ form, pingEndpoint, limits }: Props) {
  const [check, setCheck] = React.useState<
    { data: RegionChecker; error?: string } | undefined
  >();
  const [value, setValue] = React.useState<MonitorFlyRegion>(flyRegions[0]);
  const [isPending, startTransition] = React.useTransition();

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

  const { flag } = flyRegionsDict[value as keyof typeof flyRegionsDict];

  const { statusAssertions, headerAssertions } = form.getValues();

  const regions = getLimit(limits, "regions");

  return (
    <Dialog open={!!check} onOpenChange={() => setCheck(undefined)}>
      <div className="group flex h-10 items-center rounded-md bg-transparent text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <Select
          value={value}
          onValueChange={(value: MonitorFlyRegion) => setValue(value)}
        >
          <SelectTrigger
            className="flex-1 rounded-r-none border-accent focus:ring-0"
            aria-label={value}
          >
            <SelectValue>{flag}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {regions.map((region) => {
              const { flag } = flyRegionsDict[region];
              return (
                <SelectItem key={region} value={region}>
                  {flag} <span className="ml-1 font-mono">{region}</span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onClick}
                disabled={isPending}
                className="h-full flex-1 rounded-l-none focus:ring-0"
                variant="secondary"
              >
                {isPending ? (
                  <LoadingAnimation variant="inverse" />
                ) : (
                  <>
                    Test <Send className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ping your endpoint</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <DialogContent className="max-h-screen w-full overflow-auto sm:max-w-3xl sm:p-8">
        <DialogHeader>
          <DialogTitle>Response</DialogTitle>
        </DialogHeader>
        {check ? (
          <div className="grid gap-8">
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
              />
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
