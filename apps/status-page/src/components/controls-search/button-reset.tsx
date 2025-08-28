"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export function ButtonReset({ only }: { only?: string[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Determine if at least one parameter that should be reset is present (or any parameter if `only` is undefined)
  const hasParamsToReset = only
    ? only.some((key) => searchParams.has(key))
    : !!searchParams.toString();

  if (!hasParamsToReset) return null;

  const handleClick = () => {
    // Clone the current search params so we can mutate them
    const params = new URLSearchParams(searchParams.toString());

    if (only && only.length > 0) {
      // Remove only the specified keys
      only.forEach((key) => params.delete(key));
      const query = params.toString();
      router.push(
        query
          ? `${window.location.pathname}?${query}`
          : window.location.pathname,
      );
    } else {
      // No `only` prop provided – remove all query parameters
      router.push(window.location.pathname);
    }
  };

  if (!hasParamsToReset) return null;

  return (
    <Button variant="ghost" size="sm" onClick={handleClick}>
      <X />
      Reset
    </Button>
  );
}
