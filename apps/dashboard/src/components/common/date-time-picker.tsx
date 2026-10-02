"use client";

import { Calendar as CalendarIcon, Clock } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { Calendar } from "@openstatus/ui/components/ui/calendar";
import { Input } from "@openstatus/ui/components/ui/input";
import { Label } from "@openstatus/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { useIsMobile } from "@openstatus/ui/hooks/use-mobile";
import { cn } from "@openstatus/ui/lib/utils";
import { format } from "date-fns";
import { useId } from "react";

type DateTimePickerProps = {
  value: Date;
  onChange: (date: Date) => void;
  /** Days after this are not selectable. */
  max?: Date;
} & Omit<React.ComponentProps<typeof Button>, "value" | "onChange">;

/**
 * Calendar + time field in a popover. The time input is uncontrolled: a
 * controlled one gets its value attribute rewritten per keystroke and WebKit
 * then drops the focused segment.
 */
export function DateTimePicker({
  value,
  onChange,
  max,
  className,
  size = "sm",
  ...props
}: DateTimePickerProps) {
  const mobile = useIsMobile();
  const id = useId();

  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size}
          className={cn("justify-start font-normal", className)}
          {...props}
        >
          {format(value, "PP, h:mm a")}
          <CalendarIcon className="text-muted-foreground ml-auto" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="pointer-events-auto w-auto p-0"
        align="start"
        side={mobile ? "bottom" : "left"}
      >
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          onSelect={(day) => {
            if (!day) return;
            const next = new Date(day);
            next.setHours(value.getHours(), value.getMinutes(), 0, 0);
            onChange(next);
          }}
          disabled={(day) => (max ? day > max : false)}
          initialFocus
        />
        <div className="flex items-center gap-3 border-t p-3">
          <Label htmlFor={id} className="text-xs">
            Time
          </Label>
          <div className="relative grow">
            <Input
              id={id}
              type="time"
              defaultValue={format(value, "HH:mm")}
              className="peer appearance-none ps-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
              onChange={(e) => {
                const [hours, minutes] = e.target.value.split(":").map(Number);
                if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
                const next = new Date(value);
                next.setHours(hours, minutes, 0, 0);
                onChange(next);
              }}
            />
            <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
              <Clock size={16} aria-hidden="true" />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
