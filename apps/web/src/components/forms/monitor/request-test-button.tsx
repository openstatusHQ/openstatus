import React from "react";

import {
  Button,
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

import { LoadingAnimation } from "@/components/loading-animation";

interface Props {
  isPending?: boolean;
  onClick?(): void;
}

export function RequestTestButton({ isPending, onClick }: Props) {
  const [value, setValue] = React.useState<string>(flyRegions[0]);
  return (
    <div className="ring-offset-background focus-within:ring-ring group flex flex h-10 max-w-max items-center rounded-md bg-transparent text-sm focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2">
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger
          className="w-16 rounded-r-none focus:ring-0"
          aria-label={value}
        >
          <SelectValue defaultValue={flyRegions[0]}>
            {flyRegionsDict[value as keyof typeof flyRegionsDict]?.flag}
          </SelectValue>
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
              className="h-full rounded-l-none focus:ring-0"
            >
              {isPending ? <LoadingAnimation /> : <>Test</>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Send a request to your endpoint</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
