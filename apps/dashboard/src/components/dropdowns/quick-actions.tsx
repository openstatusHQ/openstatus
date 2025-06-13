"use client";

import type * as React from "react";
import { useState, useTransition } from "react";

import { type LucideIcon, MoreHorizontal, Trash2 } from "lucide-react";

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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { DropdownMenuContentProps } from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";

interface QuickActionsProps extends React.ComponentProps<typeof Button> {
  align?: DropdownMenuContentProps["align"];
  side?: DropdownMenuContentProps["side"];
  actions?: {
    id: string;
    label: string;
    icon: LucideIcon;
    variant: "default" | "destructive";
    onClick?: () => Promise<void> | void;
  }[];
  deleteAction?: {
    title: string;
    /**
     * If set, an input field will require the user input to validate deletion
     */
    confirmationValue?: string;
    submitAction?: () => Promise<void>;
  };
}

export function QuickActions({
  align = "end",
  side,
  className,
  actions,
  deleteAction,
  children,
  ...props
}: QuickActionsProps) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    try {
      startTransition(async () => {
        const promise = new Promise((resolve) => setTimeout(resolve, 1000));
        await deleteAction?.submitAction?.();
        toast.promise(promise, {
          loading: "Deleting...",
          success: "Deleted",
          error: "Failed to delete",
        });
        await promise;
        setOpen(false);
      });
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {children ?? (
            <Button
              variant="ghost"
              size="icon"
              className={className ?? "h-7 w-7 data-[state=open]:bg-accent"}
              {...props}
            >
              <MoreHorizontal />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} side={side} className="w-36">
          <DropdownMenuLabel className="sr-only">
            Quick Actions
          </DropdownMenuLabel>
          {actions
            ?.filter((item) => item.id !== "delete")
            .map((item) => (
              <DropdownMenuGroup key={item.id}>
                <DropdownMenuItem
                  variant={item.variant}
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onClick?.();
                  }}
                >
                  <item.icon className="text-muted-foreground" />
                  <span>{item.label}</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            ))}
          {deleteAction && (
            <>
              {/* NOTE: add a separator only if actions exist */}
              {actions?.length ? <DropdownMenuSeparator /> : null}
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAction.submitAction?.();
                  }}
                >
                  <Trash2 className="text-muted-foreground" />
                  Delete
                </DropdownMenuItem>
              </AlertDialogTrigger>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          // NOTE: bug where the body is not clickable after closing the alert dialog
          event.preventDefault();
          document.body.style.pointerEvents = "";
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure about deleting `{deleteAction?.title}`?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently remove the entry
            from the database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteAction?.confirmationValue ? (
          <form id="form-alert-dialog" className="space-y-0.5">
            <p className="text-muted-foreground text-xs">
              Please write &apos;
              <span className="font-semibold">
                {deleteAction?.confirmationValue}
              </span>
              &apos; to confirm
            </p>
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
          </form>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40"
            disabled={
              (deleteAction?.confirmationValue &&
                value !== deleteAction?.confirmationValue) ||
              isPending
            }
            form="form-alert-dialog"
            type="submit"
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
