import { cn } from "@/lib/utils";

export default function DevModeContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-m-2 relative rounded-lg border-2 border-destructive/80 p-2",
        className,
      )}
    >
      <p className="-top-2 absolute left-3 bg-background px-1 font-medium text-destructive text-xs uppercase">
        dev mode
      </p>
      {children}
    </div>
  );
}
