import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/components/common/link";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { DialogProps } from "@radix-ui/react-dialog";

// TODL: make it dynamic
const YML = `openstatus-marketing:
  name: OpenStatus Marketing
  description: Marketing website for OpenStatus
  active: true
  public: false
  frequency: "10m"
  regions: ["ams", "fra", "gru", "hkg", "iad"]
  kind: "http"
  request:
    url: https://api.openstatus.dev
    method: GET`;

export function ExportCodeDialog(props: DialogProps) {
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <Dialog {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Configuration</DialogTitle>
          <DialogDescription>
            Export and manage your monitor configuration using Infra as Code.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="yml">
          <TabsList>
            <TabsTrigger value="yml">YAML</TabsTrigger>
            <TabsTrigger value="terraform">Terraform</TabsTrigger>
          </TabsList>
          <TabsContent value="yml" className="space-y-2">
            <pre className="relative border rounded p-2 bg-muted text-xs">
              {YML}
              <Button
                variant="outline"
                size="icon"
                className="absolute top-2 right-2 p-1 size-7"
                onClick={() => copy(YML, { withToast: false, timeout: 1000 })}
              >
                {isCopied ? (
                  <Check className="size-3" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            </pre>
            <p className="text-xs text-muted-foreground">
              Use a <code>monitor.openstatus.yml</code> file to configure your
              monitors. <Link href="#">Read more.</Link>
            </p>
          </TabsContent>
          <TabsContent value="terraform" className="space-y-2">
            <pre className="relative border rounded p-2 bg-muted text-xs">
              TODO:
            </pre>
            {/* TODO: only showcase if there are any assertions */}
            <p className="text-xs text-destructive">
              The Terraform provider does not support assertions yet.
            </p>
            <p className="text-xs text-muted-foreground">
              Use a Terraform provider to manage your monitors.{" "}
              <Link href="#">Read more.</Link>
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
