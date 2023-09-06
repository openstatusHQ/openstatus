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
  ...props
}: ButtonWithDisableTooltipProps) => {
  const ButtonComponent = <Button {...props} disabled={disabled} />;

  if (disabled) {
    // If the button is disabled, we wrap it in a tooltip since
    // we don't want to show the tooltip if the button is enabled.
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>{ButtonComponent}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return ButtonComponent;
};
