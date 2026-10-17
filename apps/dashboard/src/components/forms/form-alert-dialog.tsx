"use client";

import { Check, Copy } from "@openstatus/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@openstatus/ui/components/ui/alert-dialog";
import { Button } from "@openstatus/ui/components/ui/button";
import { Input } from "@openstatus/ui/components/ui/input";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { cn } from "@openstatus/ui/lib/utils";
import { isTRPCClientError } from "@trpc/client";
import { createContext, useContext, useState, useTransition } from "react";
import { toast } from "sonner";

/**
 * Type-to-confirm alert dialog, built from parts:
 *
 *   <FormAlertDialogRoot confirmationValue={email} submitAction={submit}>
 *     <FormAlertDialogTrigger asChild>…</FormAlertDialogTrigger>
 *     <FormAlertDialogContent>
 *       <FormAlertDialogHeader>
 *         <FormAlertDialogTitle>…</FormAlertDialogTitle>
 *         <FormAlertDialogDescription>…</FormAlertDialogDescription>
 *       </FormAlertDialogHeader>
 *       <FormAlertDialogConfirmInput />
 *       <FormAlertDialogFooter>
 *         <FormAlertDialogCancel />
 *         <FormAlertDialogAction pendingLabel="Deleting...">Delete</FormAlertDialogAction>
 *       </FormAlertDialogFooter>
 *     </FormAlertDialogContent>
 *   </FormAlertDialogRoot>
 *
 * `FormAlertDialog` is the delete preset of the same parts.
 */

const FORM_ID = "form-alert-dialog";

type FormAlertDialogContextValue = {
  confirmationValue: string;
  value: string;
  setValue: (value: string) => void;
  isPending: boolean;
  submit: () => void;
};

const FormAlertDialogContext =
  createContext<FormAlertDialogContextValue | null>(null);

function useFormAlertDialog() {
  const context = useContext(FormAlertDialogContext);
  if (!context) {
    throw new Error(
      "FormAlertDialog parts must be used within <FormAlertDialogRoot>",
    );
  }
  return context;
}

type ToastCopy = { loading: string; success: string; error: string };

const DELETE_TOAST: ToastCopy = {
  loading: "Deleting...",
  success: "Deleted",
  error: "Failed to delete",
};

export function FormAlertDialogRoot({
  confirmationValue,
  submitAction,
  toast: toastCopy = DELETE_TOAST,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: Omit<React.ComponentProps<typeof AlertDialog>, "open"> & {
  confirmationValue: string;
  submitAction: () => Promise<void>;
  toast?: ToastCopy;
  /** Control it when the trigger unmounts, e.g. a dropdown menu item. */
  open?: boolean;
}) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;

  const handleOpenChange = (next: boolean) => {
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (!next) setValue("");
  };

  const submit = () => {
    startTransition(async () => {
      try {
        const promise = submitAction();
        toast.promise(promise, {
          loading: toastCopy.loading,
          success: toastCopy.success,
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            return toastCopy.error;
          },
        });
        await promise;
        handleOpenChange(false);
      } catch (error) {
        console.error("Failed to submit:", error);
      }
    });
  };

  return (
    <FormAlertDialogContext.Provider
      value={{ confirmationValue, value, setValue, isPending, submit }}
    >
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        {children}
      </AlertDialog>
    </FormAlertDialogContext.Provider>
  );
}

export const FormAlertDialogTrigger = AlertDialogTrigger;
export const FormAlertDialogContent = AlertDialogContent;
export const FormAlertDialogHeader = AlertDialogHeader;
export const FormAlertDialogTitle = AlertDialogTitle;
export const FormAlertDialogFooter = AlertDialogFooter;

/** Renders a `div`, so it can hold a list, which a `p` cannot. */
export function FormAlertDialogDescription({
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogDescription>) {
  return (
    <AlertDialogDescription asChild {...props}>
      <div>{children}</div>
    </AlertDialogDescription>
  );
}

export function FormAlertDialogConfirmInput({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { confirmationValue, value, setValue } = useFormAlertDialog();
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <form id={FORM_ID} className={cn("space-y-1.5", className)} {...props}>
      <p className="text-muted-foreground text-sm">
        Type{" "}
        <Button
          variant="secondary"
          size="sm"
          type="button"
          className="font-normal [&_svg]:size-3"
          onClick={() => copy(confirmationValue, { withToast: false })}
        >
          {confirmationValue}
          {isCopied ? <Check /> : <Copy />}
        </Button>{" "}
        to confirm
      </p>
      <Input value={value} onChange={(e) => setValue(e.target.value)} />
    </form>
  );
}

export function FormAlertDialogCancel({
  children = "Cancel",
  ...props
}: React.ComponentProps<typeof AlertDialogCancel>) {
  return <AlertDialogCancel {...props}>{children}</AlertDialogCancel>;
}

/** Disabled until the confirmation value is typed; submits the root action. */
export function FormAlertDialogAction({
  children,
  pendingLabel,
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogAction> & {
  pendingLabel: React.ReactNode;
}) {
  const { confirmationValue, value, isPending, submit } = useFormAlertDialog();

  return (
    <AlertDialogAction
      className={cn(
        "bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 text-white shadow-xs",
        className,
      )}
      {...props}
      disabled={value !== confirmationValue || isPending}
      form={FORM_ID}
      type="submit"
      onClick={(e) => {
        props.onClick?.(e);
        e.preventDefault();
        submit();
      }}
    >
      {isPending ? pendingLabel : children}
    </AlertDialogAction>
  );
}

/** Delete preset: a destructive button that asks to type `confirmationValue`. */
export function FormAlertDialog({
  confirmationValue,
  submitAction,
  children,
}: {
  confirmationValue: string;
  submitAction: () => Promise<void>;
  children?: React.ReactNode;
}) {
  return (
    <FormAlertDialogRoot
      confirmationValue={confirmationValue}
      submitAction={submitAction}
    >
      <FormAlertDialogTrigger asChild>
        {children ?? (
          <Button variant="destructive" size="sm">
            Delete
          </Button>
        )}
      </FormAlertDialogTrigger>
      <FormAlertDialogContent>
        <FormAlertDialogHeader>
          <FormAlertDialogTitle>
            Are you sure about delete `{confirmationValue}`?
          </FormAlertDialogTitle>
          <FormAlertDialogDescription>
            This action cannot be undone. This will permanently delete the item.
          </FormAlertDialogDescription>
        </FormAlertDialogHeader>
        <FormAlertDialogConfirmInput />
        <FormAlertDialogFooter>
          <FormAlertDialogCancel />
          <FormAlertDialogAction pendingLabel="Deleting...">
            Delete
          </FormAlertDialogAction>
        </FormAlertDialogFooter>
      </FormAlertDialogContent>
    </FormAlertDialogRoot>
  );
}
