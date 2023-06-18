"use client";

import { Button } from "@/components/ui/button";
import { experimental_useFormStatus as useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-20 disabled:opacity-100"
    >
      {pending ? (
        <div className="flex items-center justify-center gap-1">
          <div className="h-1 w-1 animate-pulse direction-alternate duration-700 rounded-full bg-primary-foreground" />
          <div className="h-1 w-1 animate-pulse direction-alternate duration-700 delay-150 rounded-full bg-primary-foreground" />
          <div className="h-1 w-1 animate-pulse direction-alternate duration-700 delay-300 rounded-full bg-primary-foreground" />
        </div>
      ) : (
        "Join"
      )}
    </Button>
  );
}
