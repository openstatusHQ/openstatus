import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import ContrastChecker from "../../contrast-checker";
import { useEditorStore } from "../../store/editor-store";

interface MoreOptionsProps
  extends React.ComponentProps<typeof DropdownMenuTrigger> {}

export function MoreOptions({ ...props }: MoreOptionsProps) {
  const { themeState } = useEditorStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild {...props}>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-foreground">
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} asChild>
          <ContrastChecker
            currentStyles={themeState.styles[themeState.currentMode]}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
