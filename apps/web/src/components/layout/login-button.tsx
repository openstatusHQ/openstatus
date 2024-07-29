"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

import type { ButtonProps } from "@openstatus/ui/src/components/button";
import { Button } from "@openstatus/ui/src/components/button";

import { cn } from "@/lib/utils";

export function LoginButton({ className, ...props }: ButtonProps) {
  const session = useSession();

  return (
    <Button asChild className={cn("rounded-full", className)} {...props}>
      {session.status === "authenticated" ? (
        <Link href="/app">Dashboard</Link>
      ) : (
        <Link href="/app/login">Sign In</Link>
      )}
    </Button>
  );
}
