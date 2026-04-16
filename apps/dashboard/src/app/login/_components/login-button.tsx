"use client";

import { Badge } from "@openstatus/ui/components/ui/badge";
import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";
import { useEffect, useState } from "react";

const STORAGE_KEY = "openstatus:last-login-provider";

type Provider = "github" | "google" | "email";

export function LoginButton({
  provider,
  children,
  onClick,
  ...props
}: {
  provider: Provider;
} & React.ComponentProps<typeof Button>) {
  const [isLastUsed, setIsLastUsed] = useState(false);

  useEffect(() => {
    const lastUsed = localStorage.getItem(STORAGE_KEY);
    setIsLastUsed(lastUsed === provider);
  }, [provider]);

  return (
    <Button
      variant="secondary"
      className={cn(
        "relative w-full",
        isLastUsed && "border border-primary",
        props.className,
      )}
      onClick={(e) => {
        localStorage.setItem(STORAGE_KEY, provider);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
      {isLastUsed ? (
        <Badge
          variant="secondary"
          className="-top-2.5 -right-2.5 absolute border border-primary bg-background text-[10px]"
        >
          Last used
        </Badge>
      ) : null}
    </Button>
  );
}
