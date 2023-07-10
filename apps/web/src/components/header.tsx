import { cn } from "@/lib/utils";

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string | null;
}

export function Header({ title, description, className }: HeaderProps) {
  return (
    <div className={cn("grid gap-1", className)}>
      <h1 className="font-cal text-3xl">{title}</h1>
      {description ? (
        <p className="text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
