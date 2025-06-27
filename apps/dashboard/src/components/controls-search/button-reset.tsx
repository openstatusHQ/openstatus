"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export function ButtonReset() {
  const searchParams = useSearchParams();
  const router = useRouter();

  if (!searchParams.toString()) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.push(window.location.pathname)}
    >
      <X />
      Reset
    </Button>
  );
}
