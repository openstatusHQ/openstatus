import { cn } from "@/lib/utils";

export function Kbd({
  children,
  className,
  ...props
}: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "-me-1 ms-2 inline-flex h-5 max-h-full items-center rounded border bg-background px-1 font-[inherit] font-medium text-[0.625rem] text-muted-foreground/70",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
