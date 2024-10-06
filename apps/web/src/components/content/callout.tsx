import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { Icons, type ValidIcon } from "../icons";

function getIconName(variant: CalloutProps["variant"]): ValidIcon {
  switch (variant) {
    case "warning":
      return "alert-triangle";
    case "success":
      return "check";
    case "error":
      return "siren";
    default:
      return "info";
  }
}

const calloutVariants = cva("border py-2 px-3 flex rounded-md", {
  variants: {
    variant: {
      info: "bg-blue-100/50 border-blue-200 text-blue-800 dark:bg-blue-900/50 dark:border-blue-800 dark:text-blue-200",
      warning:
        "bg-yellow-100/50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:border-yellow-800 dark:text-yellow-200",
      success:
        "bg-green-100/50 border-green-200 text-green-800 dark:bg-green-900/50 dark:border-green-800 dark:text-green-200",
      error:
        "bg-red-100/50 border-red-200 text-red-800 dark:bg-red-900/50 dark:border-red-800 dark:text-red-200",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

export interface CalloutProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calloutVariants> {}

export function Callout({
  variant,
  children,
  className,
  ...props
}: CalloutProps) {
  const Icon = Icons[getIconName(variant)];
  return (
    <div className={cn(calloutVariants({ variant, className }))} {...props}>
      <Icon className="my-1.5 mr-2 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
