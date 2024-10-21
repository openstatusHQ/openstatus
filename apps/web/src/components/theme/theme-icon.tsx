import { cn } from "@/lib/utils";
import { type IconProps, Icons, type ValidIcon } from "../icons";

function mapThemeToIconName(theme: string): ValidIcon {
  switch (theme) {
    case "dark":
      return "moon";
    case "light":
      return "sun";
    case "system":
      return "laptop";
    default:
      return "laptop";
  }
}

interface ThemeIconProps extends IconProps {
  theme?: string;
}

export function ThemeIcon({ theme, className, ...props }: ThemeIconProps) {
  if (!theme) return null;

  const Icon = Icons[mapThemeToIconName(theme)];
  return <Icon className={cn("h-4 w-4", className)} {...props} />;
}
