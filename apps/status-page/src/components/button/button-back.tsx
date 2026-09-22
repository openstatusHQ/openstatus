"use client";

import { Back } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";
import { useExtracted } from "next-intl";
import Link from "next/link";

export function ButtonBack({
  className,
  href = "/",
  ...props
}: React.ComponentProps<typeof Button> & { href?: string }) {
  const t = useExtracted();
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("text-muted-foreground", className)}
      asChild
      {...props}
    >
      <Link href={href}>
        <Back />
        {t("Back")}
      </Link>
    </Button>
  );
}
