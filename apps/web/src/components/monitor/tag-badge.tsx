import { Badge } from "@openstatus/ui/src/components/badge";

function getStyle(color: string) {
  return {
    borderColor: `${color}10`,
    backgroundColor: `${color}20`,
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
