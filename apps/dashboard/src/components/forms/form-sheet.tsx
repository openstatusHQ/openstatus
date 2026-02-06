"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@openstatus/ui/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@openstatus/ui/components/ui/sheet";
import { cn } from "@openstatus/ui/lib/utils";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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
        "cursor-pointer data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className,
      )}
      data-disabled={disabled}
      disabled={disabled}
      {...props}
    >
      {children}
    </SheetTrigger>
  );
}

export function FormSheetAlertDialog({
  onConfirm,
  ...props
}: React.ComponentProps<typeof AlertDialog> & {
  onConfirm: () => void;
}) {
  return (
    <AlertDialog {...props}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. Are you sure you want to discard them?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continue editing</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Discard changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const FormSheetDirtyContext = createContext<{
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
} | null>(null);

export function useFormSheetDirty() {
  const context = useContext(FormSheetDirtyContext);
  if (!context) {
    throw new Error(
      "useFormSheetDirty must be used within FormSheetWithDirtyProtection",
    );
  }
  return context;
}

export function FormSheetWithDirtyProtection({
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const shouldBypassAlert = useRef(false);

  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  // Reset states when sheet closes
  useEffect(() => {
    if (!open) {
      setIsDirty(false);
      shouldBypassAlert.current = false;
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isDirty && !shouldBypassAlert.current) {
      // User is trying to close with unsaved changes
      setShowAlert(true);
    } else {
      setOpen(newOpen);
    }
  };

  const handleDiscardChanges = () => {
    shouldBypassAlert.current = true;
    setShowAlert(false);
    setOpen(false);
  };

  const handleInteractOutside = (e: Event) => {
    if (isDirty) {
      e.preventDefault();
      setShowAlert(true);
    }
  };

  const handleEscapeKeyDown = (e: KeyboardEvent) => {
    if (isDirty) {
      e.preventDefault();
      setShowAlert(true);
    }
  };

  return (
    <FormSheetDirtyContext.Provider value={{ isDirty, setIsDirty }}>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        {/* Clone children and inject event handlers if it's SheetContent */}
        {React.Children.map(children, (child) => {
          if (
            React.isValidElement(child) &&
            (child.type === FormSheetContent || child.type === SheetContent)
          ) {
            return React.cloneElement(
              child as React.ReactElement<{
                onInteractOutside?: (e: Event) => void;
                onEscapeKeyDown?: (e: KeyboardEvent) => void;
              }>,
              {
                onInteractOutside: handleInteractOutside,
                onEscapeKeyDown: handleEscapeKeyDown,
              },
            );
          }
          return child;
        })}
      </Sheet>
      <FormSheetAlertDialog
        open={showAlert}
        onOpenChange={setShowAlert}
        onConfirm={handleDiscardChanges}
      />
    </FormSheetDirtyContext.Provider>
  );
}

export {
  SheetTitle as FormSheetTitle,
  SheetDescription as FormSheetDescription,
  Sheet as FormSheet,
};
