"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

import type { ButtonProps } from "@openstatus/ui";
import { Button } from "@openstatus/ui";

import { cn } from "@/lib/utils";

export function LoginButton({ className, ...props }: ButtonProps) {
  const session = useSession();

  return (
    <Button asChild className={cn("rounded-full", className)} {...props}>
      {session.status === "authenticated" ? (
        <Link href="/app">Dashboard</Link>
      ) : (
        <Link href="/app/login">Log In</Link>
      )}
    </Button>
  );
}
