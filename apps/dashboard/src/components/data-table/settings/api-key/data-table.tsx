import { QuickActions } from "@/components/dropdowns/quick-actions";
import { formatDate } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/components/ui/table";
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
              <TableCell className="max-w-[200px] truncate text-muted-foreground">
                {apiKey.description ?? "-"}
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
