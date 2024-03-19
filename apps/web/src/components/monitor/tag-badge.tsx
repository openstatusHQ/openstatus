import { Badge } from "@openstatus/ui";

function getStyle(color: string) {
  return {
    borderColor: `${color}20`,
    backgroundColor: `${color}30`,
    color,
  };
}

interface TagBadgeProps {
  name: string;
  color: string;
}

export function TagBadge({ color, name }: TagBadgeProps) {
  return <Badge style={getStyle(color)}>{name}</Badge>;
}
