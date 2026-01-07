import { QuickActions } from "@/components/dropdowns/quick-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { useMutation } from "@tanstack/react-query";

type ApiKey = RouterOutputs["apiKeyRouter"]["getAll"][number];

export function DataTable({
  apiKeys,
  refetch,
}: {
  apiKeys: ApiKey[];
  refetch: () => void;
}) {
  const trpc = useTRPC();
  const revokeApiKeyMutation = useMutation(
    trpc.apiKeyRouter.revoke.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );

  const truncateText = (text: string | null, maxLength: number) => {
    if (!text) return "-";
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Prefix</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apiKeys.map((apiKey) => (
            <TableRow key={apiKey.id}>
              <TableCell className="font-medium">{apiKey.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {truncateText(apiKey.description, 40)}
              </TableCell>
              <TableCell>
                <code className="text-xs">{apiKey.prefix}...</code>
              </TableCell>
              <TableCell className="text-sm">
                {apiKey.expiresAt ? formatDate(apiKey.expiresAt) : "-"}
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <QuickActions
                    deleteAction={{
                      confirmationValue: apiKey.name ?? "api key",
                      submitAction: async () =>
                        await revokeApiKeyMutation.mutateAsync({
                          keyId: apiKey.id,
                        }),
                    }}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
