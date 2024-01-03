import type { ExternalToast } from "sonner";
import { toast as sonner } from "sonner";

type ToastType =
  | "default"
  | "description"
  | "success"
  | "warning"
  | "info"
  | "error"
  | "promise";

const config = {
  error: {
    type: "error",
    title: "Something went wrong",
    description: "Please try again",
    action: {
      label: "Discord",
      onClick: () => window.open("/discord", "_blank")?.location,
    },
  },
  "unique-slug": {
    type: "warning",
    title: "Slug is already taken",
    description: "Please select another slug. Every slug is unique.",
  },
  success: { type: "success", title: "Success" },
  deleted: { type: "success", title: "Deleted successfully" }, // TODO: we are not informing the user besides the visual changes when an entry has been deleted
  removed: { type: "success", title: "Removed successfully" },
  saved: { type: "success", title: "Saved successfully" },
  "test-error": {
    type: "error",
    title: "Connection Failed",
    description: "Please enter a correct URL",
  },
  "test-warning-empty-url": {
    type: "warning",
    title: "URL is Empty",
    description: "Please enter a valid, non-empty URL",
  },
  "test-success": {
    type: "success",
    title: "Connection Established",
  },
} as const;

const _config: Record<
  string,
  Pick<ExternalToast, "action" | "description"> & {
    type: ToastType;
    title: string;
  }
> = config;

type ToastAction = keyof typeof config;

export function toast(action: ToastAction) {
  const { title, type, ...props } = _config[action];

  if (type === "default") return sonner(title, props);
  if (type === "success") return sonner.success(title, props);
  if (type === "error") return sonner.error(title, props);
  if (type === "warning") return sonner.warning(title, props);
  if (type === "description") return sonner.message(title, props);
  if (type === "info") return sonner.info(title, props);
}
