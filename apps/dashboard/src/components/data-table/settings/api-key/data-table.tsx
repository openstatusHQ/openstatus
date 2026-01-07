import { FormAlertDialog } from "@/components/forms/form-alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

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

  const formatDate = (date: Date | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString();
  };

  const formatLastUsed = (date: Date | null) => {
    if (!date) return "Never";
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

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
            <TableHead>Created</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm">
                    {formatDate(apiKey.createdAt)}
                  </span>
                  {apiKey.createdBy && (
                    <span className="text-muted-foreground text-xs">
                      by{" "}
                      {apiKey.createdBy.firstName && apiKey.createdBy.lastName
                        ? `${apiKey.createdBy.firstName} ${apiKey.createdBy.lastName}`
                        : apiKey.createdBy.email}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatLastUsed(apiKey.lastUsedAt)}
              </TableCell>
              <TableCell className="text-sm">
                {formatDate(apiKey.expiresAt)}
              </TableCell>
              <TableCell className="text-right">
                <FormAlertDialog
                  confirmationValue={apiKey.name}
                  submitAction={async () => {
                    await revokeApiKeyMutation.mutateAsync({
                      keyId: apiKey.id,
                    });
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
