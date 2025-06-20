"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function FormSheetContent({
  children,
  className,
  ...props
}: React.ComponentProps<typeof SheetContent>) {
  return (
    <SheetContent className={cn("max-h-screen gap-0", className)} {...props}>
      {children}
    </SheetContent>
  );
}

export function FormSheetHeader({
  children,
  className,
  ...props
}: React.ComponentProps<typeof SheetHeader>) {
  return (
    <SheetHeader
      className={cn("sticky top-0 border-b bg-background", className)}
      {...props}
    >
      {children}
    </SheetHeader>
  );
}

export function FormSheetFooter({
  children,
  className,
  ...props
}: React.ComponentProps<typeof SheetFooter>) {
  return (
    <SheetFooter
      className={cn("sticky bottom-0 border-t bg-background", className)}
      {...props}
    >
      {children}
    </SheetFooter>
  );
}

export function FormSheetFooterInfo({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-muted-foreground/70 text-xs", className)} {...props}>
      {children}
    </p>
  );
}

export function FormSheetTrigger({
  children,
  className,
  disabled,
  ...props
}: React.ComponentProps<typeof SheetTrigger>) {
  return (
    <SheetTrigger
      className={cn(
        "cursor-pointer data-[disabled=true]:opacity-50 data-[disabled=true]:pointer-events-none",
        className
      )}
      data-disabled={disabled}
      disabled={disabled}
      {...props}
    >
      {children}
    </SheetTrigger>
  );
}

export {
  SheetTitle as FormSheetTitle,
  SheetDescription as FormSheetDescription,
  Sheet as FormSheet,
};
