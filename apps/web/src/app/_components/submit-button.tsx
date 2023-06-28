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
        // TODO: move into separate file `LoadingAnimation`
        <div className="flex items-center justify-center gap-1">
          <div className="direction-alternate bg-primary-foreground h-1 w-1 animate-pulse rounded-full duration-700" />
          <div className="direction-alternate bg-primary-foreground h-1 w-1 animate-pulse rounded-full delay-150 duration-700" />
          <div className="direction-alternate bg-primary-foreground h-1 w-1 animate-pulse rounded-full delay-300 duration-700" />
        </div>
      ) : (
        "Join"
      )}
    </Button>
  );
}
