"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function ButtonBack({
  className,
  href = "/",
  ...props
}: React.ComponentProps<typeof Button> & { href?: string }) {
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
        Back
      </Link>
    </Button>
  );
}
