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

// TODO: rename to DataTableViewer?

export function DataTableSheetContent({
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

export function DataTableSheetHeader({
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

export function DataTableSheetFooter({
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

export function DataTableSheetFooterInfo({
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
  SheetTitle as DataTableSheetTitle,
  SheetDescription as DataTableSheetDescription,
  SheetTrigger as DataTableSheetTrigger,
  Sheet as DataTableSheet,
};
