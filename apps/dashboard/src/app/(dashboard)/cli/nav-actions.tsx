import { NavFeedback } from "@/components/nav/nav-feedback";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Book } from "lucide-react";

export function NavActions() {
  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="group h-7 w-7" asChild>
              <a
                href={"https://docs.openstatus.dev/cli/getting-started/"}
                target="_blank"
                rel="noreferrer"
              >
                <Book className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>View Documentation</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
