"use client";

import { type ComponentProps, useEffect, useState } from "react";

import { CheckIcon, MinusIcon } from "lucide-react";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";

import { Label } from "@openstatus/ui/components/ui/label";

const items = ["Child 1", "Child 2", "Child 3"];

function Checkbox(props: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className="peer group size-4 shrink-0 rounded-[4px] border border-input shadow-xs outline-none transition-shadow focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:text-foreground dark:bg-input/30 dark:data-[state=checked]:bg-primary dark:aria-invalid:ring-destructive/40"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <MinusIcon className="hidden size-2.5 group-data-[state=indeterminate]:block" />
        <CheckIcon className="hidden size-3.5 group-data-[state=checked]:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function CheckboxTree() {
  const [checked, setChecked] =
    useState<CheckboxPrimitive.CheckedState>("indeterminate");
  const [selected, setSelected] = useState<string[]>(["Child 1", "Child 2"]);

  useEffect(() => {
    if (selected.length === items.length) {
      setChecked(true);
    } else if (selected.length > 0) {
      setChecked("indeterminate");
    } else {
      setChecked(false);
    }
  }, [selected]);

  const handleCheckedChange = (checked: CheckboxPrimitive.CheckedState) => {
    setChecked(checked);

    if (checked === true) {
      setSelected([...items]);
    } else if (checked === false) {
      setSelected([]);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="parent"
          checked={checked}
          onCheckedChange={handleCheckedChange}
        />
        <Label htmlFor="parent">Parent</Label>
      </div>
      <div className="flex flex-col gap-2 pl-6">
        {items.map((label) => (
          <div key={label} className="flex items-center gap-2">
            <Checkbox
              id={label}
              checked={selected.includes(label)}
              onCheckedChange={(checked) =>
                setSelected(
                  checked
                    ? [...selected, label]
                    : selected.filter((item) => item !== label),
                )
              }
            />
            <Label htmlFor={label}>{label}</Label>
          </div>
        ))}
      </div>
    </div>
  );
}
