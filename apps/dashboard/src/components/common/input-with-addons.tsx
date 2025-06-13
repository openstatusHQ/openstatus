import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "../ui/input";

export interface InputWithAddonsProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

// "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
//         "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
//         "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",

const InputWithAddons = React.forwardRef<
  HTMLInputElement,
  InputWithAddonsProps
>(({ leading, trailing, className, ...props }, ref) => {
  return (
    <div className={cn("flex rounded-md shadow-xs", className)}>
      {leading ? (
        <span className="inline-flex items-center rounded-s-md border border-input bg-muted px-3 text-muted-foreground text-sm">
          {leading}
        </span>
      ) : null}
      <Input
        ref={ref}
        className={cn("z-1 shadow-none", {
          "-ms-px rounded-s-none": leading,
          "-me-px rounded-e-none": trailing,
        })}
        placeholder="google.com"
        type="text"
        {...props}
      />
      {trailing ? (
        <span className="inline-flex items-center rounded-e-md border border-input bg-muted px-3 text-muted-foreground text-sm">
          {trailing}
        </span>
      ) : null}
    </div>
  );
});

InputWithAddons.displayName = "InputWithAddons";

export { InputWithAddons };
