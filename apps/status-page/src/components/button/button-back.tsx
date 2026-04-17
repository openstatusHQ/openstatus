"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";
import { ArrowLeft } from "lucide-react";
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
        <ArrowLeft />
        {t("Back")}
      </Link>
    </Button>
  );
}
