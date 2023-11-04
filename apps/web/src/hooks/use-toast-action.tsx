import { Button, useToast } from "@openstatus/ui";
import type { ToastType } from "@openstatus/ui";

const config = {
  error: {
    title: "Something went wrong",
    description: "Please try again",
    variant: "destructive",
    action: (
      <Button variant="outline" asChild className="text-foreground">
        <a href="/discord" target="_blank" rel="noreferrer">
          Discord
        </a>
      </Button>
    ),
  },
  "unique-slug": {
    title: "Slug is already taken",
    description: "Please select another slug. Every slug is unique.",
    variant: "warning",
  },
  success: { title: "Success" },
  deleted: { title: "Deleted successfully" }, // TODO: we are not informing the user besides the visual changes when an entry has been deleted
  saved: { title: "Saved successfully" },
  "test-error": {
    title: "Connection Failed",
    // description: "Be sure to include the auth headers.",
    variant: "destructive",
  },
  "test-warning-empty-url": {
    title: "URL is Empty",
    description: "Please enter a valid, non-empty URL",
    variant: "warning",
  },
  "test-success": {
    title: "Connection Established",
  },
} as const satisfies Record<string, ToastType>;

type ToastAction = keyof typeof config;

export function useToastAction() {
  const { toast: defaultToast } = useToast();

  function toast(action: ToastAction) {
    return defaultToast(config[action]);
  }

  return { toast };
}
