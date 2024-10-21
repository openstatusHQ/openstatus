import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@openstatus/ui";
import Link from "next/link";
import { Icons } from "../icons";

export function SpeedCheckerButton({ className, ...props }: ButtonProps) {
  return (
    <Button className={cn("rounded-full group", className)} asChild {...props}>
      <Link href="/play/checker">
        Speed Checker{" "}
        <Icons.gauge className="ml-1 h-4 w-4 [&>*:first-child]:transition-transform [&>*:first-child]:origin-[12px_14px] [&>*:first-child]:-rotate-90 [&>*:first-child]:group-hover:rotate-0 [&>*:first-child]:duration-500 [&>*:first-child]:ease-out" />
      </Link>
    </Button>
  );
}
