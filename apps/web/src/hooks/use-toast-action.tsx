import { Button } from "@openstatus/ui/src/components/button";
import { useToast } from "@openstatus/ui/src/components/use-toast";
import type { Toast } from "@openstatus/ui/src/components/use-toast";

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
} as const satisfies Record<string, Toast>;

type ToastAction = keyof typeof config;

export function useToastAction() {
  const { toast: defaultToast } = useToast();

  function toast(action: ToastAction) {
    return defaultToast(config[action]);
  }

  return { toast };
}
