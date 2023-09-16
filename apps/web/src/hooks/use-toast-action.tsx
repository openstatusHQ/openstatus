import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import type { Toast } from "@/components/ui/use-toast";

const config = {
  error: {
    title: "Something went wrong.",
    description: "Please try again.",
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
    title: "Slug is already taken.",
    description: "Please select another slug. Every slug is unique.",
  },
  success: { title: "Success" },
  deleted: { title: "Deleted successfully." }, // TODO: we are not informing the user besides the visual changes when an entry has been deleted
  saved: { title: "Saved successfully." },
  "test-error": {
    title: "Endpoint configuration failed.",
    // description: "Be sure to include the auth headers.",
    variant: "destructive",
  },
  "test-success": {
    title: "Endpoint configuration passed.",
  },
} as const satisfies Record<string, Toast>;

type ToastAction = keyof typeof config;

export function useToastAction() {
  const { toast: defaultToast } = useToast();

  function toast(action: ToastAction) {
    return defaultToast(config[action]);
  }

  return { toast };
}
