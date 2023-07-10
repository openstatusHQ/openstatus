import { cn } from "@/lib/utils";

type ShellProps = React.HTMLAttributes<HTMLDivElement>;

function Shell({ children, className }: ShellProps) {
  return (
    <div
      className={cn(
        "border-border w-full rounded-lg border p-3 backdrop-blur-[2px] md:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export { Shell };
