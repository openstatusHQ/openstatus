"use client";

import { Close } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { Kbd, KbdGroup } from "@openstatus/ui/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent } from "react";

import { isResetShortcut, useModifierKey } from "@/lib/keyboard";

export function ButtonReset({ only }: { only?: string[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const modifier = useModifierKey();

  // Determine if at least one parameter that should be reset is present (or any parameter if `only` is undefined)
  const hasParamsToReset = only
    ? only.some((key) => searchParams.has(key))
    : !!searchParams.toString();

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

  const onShortcut = useEffectEvent(handleClick);

  useEffect(() => {
    if (!hasParamsToReset) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isResetShortcut(e)) return;
      e.preventDefault();
      onShortcut();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasParamsToReset]);

  if (!hasParamsToReset) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm" onClick={handleClick}>
            <Close />
            Reset
          </Button>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2">
          Reset filters
          <KbdGroup>
            <Kbd>{modifier}</Kbd>
            <Kbd>Esc</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
