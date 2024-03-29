import React from "react";
import { Send } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import type {
  InsertMonitor,
  MonitorFlyRegion,
} from "@openstatus/db/src/schema";
import {
  Button,
  Dialog,
  DialogContent,
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
import { flyRegions, flyRegionsDict } from "@openstatus/utils";

import { RegionInfo } from "@/app/play/checker/[id]/_components/region-info";
import { ResponseDetailTabs } from "@/app/play/checker/[id]/_components/response-detail-tabs";
import type { RegionChecker } from "@/app/play/checker/[id]/utils";
import { LoadingAnimation } from "@/components/loading-animation";
import { toastAction } from "@/lib/toast";

interface Props {
  form: UseFormReturn<InsertMonitor>;
  pingEndpoint(region?: MonitorFlyRegion): Promise<RegionChecker>;
}

export function RequestTestButton({ form, pingEndpoint }: Props) {
  const [check, setCheck] = React.useState<RegionChecker | undefined>();
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
        const data = await pingEndpoint(value);
        setCheck(data);
        const isOk = data.status >= 200 && data.status < 300;
        if (isOk) {
          toastAction("test-success");
        } else {
          toastAction("test-error");
        }
      } catch {
        toastAction("error");
      }
    });
  };

  const { flag } = flyRegionsDict[value as keyof typeof flyRegionsDict];

  return (
    <Dialog open={!!check} onOpenChange={() => setCheck(undefined)}>
      <div className="ring-offset-background focus-within:ring-ring group flex h-10 items-center rounded-md bg-transparent text-sm focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2">
        <Select
          value={value}
          onValueChange={(value: MonitorFlyRegion) => setValue(value)}
        >
          <SelectTrigger
            className="flex-1 rounded-r-none focus:ring-0"
            aria-label={value}
          >
            <SelectValue>{flag}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {flyRegions.map((region) => {
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
              >
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
              <p>Send a request to your endpoint</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <DialogContent className="max-h-screen w-full overflow-auto sm:max-w-3xl sm:p-8">
        {check ? (
          <div className="grid gap-8">
            <RegionInfo check={check} />
            <ResponseDetailTabs timing={check.timing} headers={check.headers} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
