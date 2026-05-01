"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function NavLogout({
  onClick,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children">) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) signOut();
      }}
      {...props}
    >
      <LogOut className="size-3" />
      Log out
    </Button>
  );
}
