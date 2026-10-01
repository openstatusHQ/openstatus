"use client";

import { Badge } from "@openstatus/ui/components/ui/badge";
import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";
import { useEffect, useState } from "react";

const STORAGE_KEY = "openstatus:last-login-provider";

type Provider = "github" | "google" | "oidc" | "email";

export function LoginButton({
  provider,
  children,
  onClick,
  className,
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
        isLastUsed && "border-primary border",
        className,
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
          variant="outline"
          className="text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2 px-1.5 text-[10px] font-normal"
        >
          Last used
        </Badge>
      ) : null}
    </Button>
  );
}
