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
import { format, startOfDay } from "date-fns";
import { useId } from "react";

type DateTimePickerProps = {
  value: Date;
  onChange: (date: Date) => void;
  /** Bounds, inclusive; a picked time is clamped into them. */
  min?: Date;
  max?: Date;
} & Omit<React.ComponentProps<typeof Button>, "value" | "onChange">;

/**
 * Calendar + time field in a popover. The time input is uncontrolled: a
 * controlled one gets its value attribute rewritten per keystroke and WebKit
 * then drops the focused segment. It only follows `value` on open, so an
 * external change while the popover is open is not reflected in it.
 */
export function DateTimePicker({
  value,
  onChange,
  min,
  max,
  className,
  size = "sm",
  ...props
}: DateTimePickerProps) {
  const mobile = useIsMobile();
  const id = useId();

  /** Clamps into the bounds and reports a change; returns what was applied. */
  function commit(next: Date) {
    if (Number.isNaN(next.getTime())) return null;
    const clamped =
      min && next < min ? min : max && next > max ? max : next;
    if (clamped.getTime() !== value.getTime()) onChange(clamped);
    return clamped;
  }

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
            next.setHours(
              value.getHours(),
              value.getMinutes(),
              value.getSeconds(),
              value.getMilliseconds(),
            );
            commit(next);
          }}
          disabled={(day) =>
            (min ? day < startOfDay(min) : false) || (max ? day > max : false)
          }
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
                // "" while a segment is cleared
                if (!e.target.value) return;
                const [hours, minutes] = e.target.value.split(":").map(Number);
                const next = new Date(value);
                next.setHours(hours, minutes);
                const applied = commit(next);
                // show the clamped time instead of what was typed
                if (applied && applied.getTime() !== next.getTime()) {
                  e.target.value = format(applied, "HH:mm");
                }
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
