import { cn } from "../lib/utils";

export interface PillProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  labelClassName?: string;
}

export function Pill({
  label,
  labelClassName,
  className,
  children,
  ...props
}: PillProps) {
  return (
    <div
      className={cn(
        "overflow-hidden inline-flex items-center border rounded-full font-medium text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        className,
      )}
      {...props}
    >
      <span className={cn("px-1.5 py-0.5 bg-muted border-r", labelClassName)}>
        {label}
      </span>
      <span className="px-1.5 py-0.5">{children}</span>
    </div>
  );
}
