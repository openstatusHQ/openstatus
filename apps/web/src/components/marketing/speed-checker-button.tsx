import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@openstatus/ui";
import Link from "next/link";
import { Icons } from "../icons";

export function SpeedCheckerButton({ className, ...props }: ButtonProps) {
  return (
    <Button className={cn("rounded-full", className)} asChild {...props}>
      <Link href="/play/checker">
        Speed Checker <Icons.gauge className="ml-1 h-4 w-4" />
      </Link>
    </Button>
  );
}
