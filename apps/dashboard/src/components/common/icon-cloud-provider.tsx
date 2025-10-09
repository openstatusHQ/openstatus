import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Fly, Koyeb, Railway } from "@openstatus/icons";
import { Globe } from "lucide-react";

export function IconCloudProvider({
  provider,
  className,
}: React.ComponentProps<"svg"> & {
  provider: string;
}) {
  switch (provider) {
    case "fly":
      return <Fly className={cn("size-4", className)} />;
    case "koyeb":
      return <Koyeb className={cn("size-4", className)} />;
    case "railway":
      return <Railway className={cn("size-4", className)} />;
    default:
      return <Globe className={cn("size-4", className)} />;
  }
}

export function IconCloudProviderTooltip(
  props: React.ComponentProps<typeof IconCloudProvider>,
) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger
          type="button"
          className="rounded-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-offset-2"
        >
          <IconCloudProvider {...props} />
        </TooltipTrigger>
        <TooltipContent className="capitalize">{props.provider}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
