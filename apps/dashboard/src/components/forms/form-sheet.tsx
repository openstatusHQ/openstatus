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
      className={cn("border-b sticky top-0 bg-background", className)}
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
      className={cn("border-t sticky bottom-0 bg-background", className)}
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

export {
  SheetTitle as FormSheetTitle,
  SheetDescription as FormSheetDescription,
  SheetTrigger as FormSheetTrigger,
  Sheet as FormSheet,
};
