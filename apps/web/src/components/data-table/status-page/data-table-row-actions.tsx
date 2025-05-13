"use client";

import type { Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { selectPageSchema } from "@openstatus/db/src/schema";
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
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Label,
  RadioGroup,
  RadioGroupItem,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";

export const SIZE: Record<string, { width: number; height: number }> = {
  sm: { width: 120, height: 34 },
  md: { width: 160, height: 46 },
  lg: { width: 200, height: 56 },
  xl: { width: 240, height: 68 },
};

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const page = selectPageSchema.parse(row.original);
  const router = useRouter();
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [size, setSize] = React.useState<"sm" | "md" | "lg" | "xl">("sm");
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  const { copy } = useCopyToClipboard();

  async function onDelete() {
    startTransition(async () => {
      try {
        if (!page.id) return;
        await api.page.delete.mutate({ id: page.id });
        toastAction("deleted");
        router.refresh();
        setAlertOpen(false);
      } catch {
        toastAction("error");
      }
    });
  }

  return (
    <Dialog>
      <AlertDialog
        open={alertOpen}
        onOpenChange={(value) => setAlertOpen(value)}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 data-[state=open]:bg-accent"
            >
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Link href={`./status-pages/${page.id}/edit`}>
              <DropdownMenuItem>Edit</DropdownMenuItem>
            </Link>
            <Link
              href={
                process.env.NODE_ENV === "production"
                  ? `https://${page.slug}.openstatus.dev`
                  : `/status-page/${page.slug}`
              }
              target="_blank"
            >
              <DropdownMenuItem>Visit</DropdownMenuItem>
            </Link>
            <DropdownMenuItem
              onClick={() =>
                copy(`${page.id}`, {
                  withToast: `Copied ID '${page.id}'`,
                })
              }
            >
              Copy ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <Link href={`./status-pages/${page.id}/reports/new`}>
              <DropdownMenuItem>Create Report</DropdownMenuItem>
            </Link>
            <DialogTrigger asChild>
              <DropdownMenuItem>Create Badge</DropdownMenuItem>
            </DialogTrigger>
            <DropdownMenuSeparator />
            <AlertDialogTrigger asChild>
              <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-background">
                Delete
              </DropdownMenuItem>
            </AlertDialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              monitor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {!isPending ? "Delete" : <LoadingAnimation />}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Badge</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Create an uptime badge for your status page.
          </DialogDescription>
          <div className="flex items-center justify-center">
            <div className="flex w-full items-center justify-center rounded-md border p-4">
              <img
                src={`/status-page/${page.slug}/badge?size=${size}&theme=${theme}`}
                alt="Badge"
                width={SIZE[size].width}
                height={SIZE[size].height}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <RadioGroup
              className="flex"
              onValueChange={(value) =>
                setSize(value as "sm" | "md" | "lg" | "xl")
              }
              value={size}
            >
              {Object.keys(SIZE).map((size) => (
                <div className="flex items-center space-x-2" key={size}>
                  <RadioGroupItem value={size} id={size} />
                  <Label htmlFor={size}>{size}</Label>
                </div>
              ))}
            </RadioGroup>
            <div>
              <span className="font-mono text-muted-foreground text-sm">
                {SIZE[size].width}x{SIZE[size].height}
              </span>
            </div>
          </div>
          <RadioGroup
            className="flex"
            onValueChange={(value) => setTheme(value as "light" | "dark")}
            value={theme}
          >
            {["light", "dark"].map((theme) => (
              <div className="flex items-center space-x-2" key={theme}>
                <RadioGroupItem value={theme} id={theme} />
                <Label htmlFor={theme}>{theme}</Label>
              </div>
            ))}
          </RadioGroup>
          <div className="flex items-center justify-center">
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              onClick={() =>
                copy(
                  `https://openstatus.dev/status-page/${page.slug}/badge?size=${size}&theme=${theme}`,
                  { withToast: true },
                )
              }
            >
              https://openstatus.dev/status-page/{page.slug}/badge?size={size}
              &theme={theme}
            </Button>
          </div>
        </DialogContent>
      </AlertDialog>
    </Dialog>
  );
}
