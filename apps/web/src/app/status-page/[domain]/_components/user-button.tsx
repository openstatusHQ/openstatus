"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

import { Button } from "@openstatus/ui";

// Create a button only displayed if you are logged in and are the owner of the status page
export function UserButton() {
  const { isSignedIn } = useUser();
  if (isSignedIn) {
    return (
      <Button asChild>
        <Link href="https://openstatus.dev/app">OpenStatus Dashboard</Link>
      </Button>
    );
  }
  return null;
}
