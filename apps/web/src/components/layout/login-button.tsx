"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

import type { ButtonProps } from "@openstatus/ui";
import { Button } from "@openstatus/ui";

import { cn } from "@/lib/utils";

export function LoginButton({ className, ...props }: ButtonProps) {
  const { isSignedIn } = useUser();

  return (
    <Button asChild className={cn("rounded-full", className)} {...props}>
      {isSignedIn ? (
        <Link href="/app">Dashboard</Link>
      ) : (
        <Link href="/app/sign-up">Sign Up</Link>
      )}
    </Button>
  );
}
