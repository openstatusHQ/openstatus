"use client";

import { Badge } from "@openstatus/ui/components/ui/badge";
import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";
import { useEffect, useState } from "react";

export const STORAGE_KEY = "openstatus:last-login-provider";

type Provider = "github" | "google" | "oidc" | "sso" | "email";

export function LoginButton({
  provider,
  children,
  onClick,
  className,
  variant = "secondary",
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
      variant={variant}
      className={cn("relative w-full", className)}
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
          // inherits the button's text color so it reads on both variants
          className="absolute top-1/2 right-2 -translate-y-1/2 border-transparent bg-current/10 px-1.5 text-[10px] font-normal text-current opacity-80"
        >
          Last used
        </Badge>
      ) : null}
    </Button>
  );
}
