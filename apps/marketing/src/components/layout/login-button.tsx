import type { ButtonProps } from "@openstatus/ui/src/components/button";
import { Button } from "@openstatus/ui/src/components/button";

import { cn } from "@/lib/utils";

export function LoginButton({ className, ...props }: ButtonProps) {
  return (
    <Button asChild className={cn("rounded-full", className)} {...props}>
      <a href="https://app.openstatus.dev">Dashboard</a>
    </Button>
  );
}
