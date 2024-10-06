import { CheckCircle2 } from "lucide-react";

import { Checkbox, Label } from "@openstatus/ui";

import { cn } from "@/lib/utils";

interface Props {
  id: string;
  children: React.ReactNode;
  checked?: boolean;
  onCheckedChange(checked: boolean): void;
  className?: string;
  name: string;
  disabled?: boolean;
}

export function CheckboxLabel({
  id,
  children,
  checked,
  onCheckedChange,
  className,
  name,
  disabled,
}: Props) {
  return (
    <div className="relative h-full">
      <Checkbox
        id={`${name}-${id}`}
        name={name}
        className="peer sr-only"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
      <Label
        htmlFor={`${name}-${id}`}
        className={cn(
          "flex h-full items-center gap-1 rounded-md border border-border bg-popover p-4 pr-10 hover:bg-accent hover:text-accent-foreground peer-disabled:text-muted-foreground peer-disabled:hover:bg-background peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary",
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
