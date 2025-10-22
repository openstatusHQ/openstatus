import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Palette } from "lucide-react";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "../content/empty-state";
import { Button } from "../ui/button";

export function ThemePalettePicker() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="outline">
          <Palette className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-90">
        <EmptyStateContainer>
          <EmptyStateTitle>
            Help us ship an epic palette picker!
          </EmptyStateTitle>
          <EmptyStateDescription>
            We are looking for contributions to build an epic palette picker to
            help others generate and export their own themes.
          </EmptyStateDescription>
        </EmptyStateContainer>
      </PopoverContent>
    </Popover>
  );
}
