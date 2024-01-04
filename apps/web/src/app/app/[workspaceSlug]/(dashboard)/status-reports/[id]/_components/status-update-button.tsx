"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@openstatus/ui";

export function StatusUpdateButton() {
  const pathname = usePathname();

  if (pathname.endsWith("/update/edit")) {
    return <Button disabled>Status Update</Button>;
  }

  return (
    <Button asChild>
      <Link href="./update/edit">Status Update</Link>
    </Button>
  );
}
