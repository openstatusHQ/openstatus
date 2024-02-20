import { CheckCircle2 } from "lucide-react";

import { Checkbox, Label } from "@openstatus/ui";

import { cn } from "@/lib/utils";

interface Props {
  id: string;
  children: React.ReactNode;
  checked?: boolean;
  onCheckedChange(checked: boolean): void;
  className?: string;
}

export function CheckboxLabel({
  id,
  children,
  checked,
  onCheckedChange,
  className,
}: Props) {
  return (
    <div className="relative h-full">
      <Checkbox
        id={id}
        className="peer sr-only"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
      <Label
        htmlFor={id}
        className={cn(
          "border-border bg-popover hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary flex h-full items-center gap-1 rounded-md border p-4 pr-10",
          className,
        )}
      >
        {children}
      </Label>
      <div className="absolute inset-y-0 right-4 hidden items-center peer-data-[state=checked]:flex [&:has([data-state=checked])]:flex">
        <CheckCircle2 className="h-4 w-4" />
      </div>
    </div>
  );
}
