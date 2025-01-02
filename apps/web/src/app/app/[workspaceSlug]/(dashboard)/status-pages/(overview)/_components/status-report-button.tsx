import { cn } from "@/lib/utils";
import type { Page } from "@openstatus/db/src/schema";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@openstatus/ui/src/components/alert";
import { buttonVariants } from "@openstatus/ui/src/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openstatus/ui/src/components/dropdown-menu";
import { ChevronDown, Megaphone } from "lucide-react";
import Link from "next/link";

export function StatusReportButton({ pages }: { pages: Page[] }) {
  return (
    <Alert className="max-w-xl">
      <AlertTitle>Status Reports</AlertTitle>
      <AlertDescription>
        Start a new report. If you want to update your users about a current
        report, please hover the <em>Last Report</em> column and click on{" "}
        <em>Go to report</em>.
      </AlertDescription>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ size: "sm", variant: "secondary" }),
            "mt-2",
          )}
        >
          <Megaphone className="h-4 w-4 mr-1 pb-0.5" />
          New Status Report
          <span className="h-8 w-px bg-background mx-2" />
          <ChevronDown className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Select Page</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {pages.map((page) => (
            <Link key={page.id} href={`./status-pages/${page.id}/reports/new`}>
              <DropdownMenuItem>{page.title}</DropdownMenuItem>
            </Link>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </Alert>
  );
}
