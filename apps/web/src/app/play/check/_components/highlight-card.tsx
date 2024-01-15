import { Card, CardContent, CardHeader, CardTitle } from "@openstatus/ui";

import type { ValidIcon } from "@/components/icons";
import { Icons } from "@/components/icons";

interface Props {
  title: string;
  value: string | number;
  description?: string;
  icon: ValidIcon;
}

export function HighlightCard({ title, value, description, icon }: Props) {
  const Icon = Icons[icon];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-muted-foreground text-xs">{description}</p>
      </CardContent>
    </Card>
  );
}
