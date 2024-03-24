import { cn } from "../lib/utils";
import { Button } from "./button";
import type { ButtonProps } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

interface ButtonWithDisableTooltipProps extends ButtonProps {
  tooltip: string;
}

export const ButtonWithDisableTooltip = ({
  tooltip,
  disabled,
  className,
  ...props
}: ButtonWithDisableTooltipProps) => {
  const ButtonComponent = (
    <Button
      {...props}
      disabled={disabled}
      className={cn(className, disabled && "pointer-events-none")}
    />
  );

  if (disabled) {
    // If the button is disabled, we wrap it in a tooltip since
    // we don't want to show the tooltip if the button is enabled.
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{ButtonComponent}</span>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return ButtonComponent;
};
