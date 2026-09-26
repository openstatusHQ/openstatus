import {
  StatusComponent,
  StatusComponentHeader,
  StatusComponentHeaderLeft,
  StatusComponentHeaderRight,
  StatusComponentIcon,
  StatusComponentStatus,
  StatusComponentTitle,
} from "@openstatus/ui/components/blocks/status-component";
import { Button } from "@openstatus/ui/components/ui/button";
import { Input } from "@openstatus/ui/components/ui/input";
import { Label } from "@openstatus/ui/components/ui/label";
import { Switch } from "@openstatus/ui/components/ui/switch";

import { demo } from "@/data/demo-data";

import {
  Cell,
  CellBody,
  CellDescription,
  CellGrid,
  CellGridItem,
  CellHeader,
  CellTitle,
} from "./cell";

/** Same workspace, two audiences: the public page and the gated internal one. */
export function AccessDemo() {
  const monitors = demo.components.filter((c) => !c.external);
  return (
    <Cell>
      <CellGrid cols={1} sm={2}>
        <CellGridItem className="p-0">
          <Cell className="border-0">
            <CellHeader>
              <CellTitle>{demo.company.domain}</CellTitle>
              <CellDescription>public</CellDescription>
            </CellHeader>
            <CellBody className="flex flex-col gap-3">
              {monitors.map((c) => (
                <StatusComponent key={c.name} variant={c.status}>
                  <StatusComponentHeader>
                    <StatusComponentHeaderLeft>
                      <StatusComponentIcon />
                      <StatusComponentTitle>{c.name}</StatusComponentTitle>
                    </StatusComponentHeaderLeft>
                    <StatusComponentHeaderRight>
                      <StatusComponentStatus />
                    </StatusComponentHeaderRight>
                  </StatusComponentHeader>
                </StatusComponent>
              ))}
            </CellBody>
          </Cell>
        </CellGridItem>
        <CellGridItem className="p-0">
          <Cell className="border-0">
            <CellHeader>
              <CellTitle>{demo.company.internalDomain}</CellTitle>
              <CellDescription>password · IP allowlist</CellDescription>
            </CellHeader>
            <CellBody className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <div className="font-medium">Protected Page</div>
                <p className="text-muted-foreground text-xs">
                  Enter the password to access the status page.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="demo-access-password">Password</Label>
                <Input
                  id="demo-access-password"
                  type="password"
                  defaultValue="northwind-internal"
                  readOnly
                />
              </div>
              <Button type="button" className="w-full">
                Submit
              </Button>
            </CellBody>
          </Cell>
        </CellGridItem>
      </CellGrid>
      <CellBody className="flex flex-wrap gap-x-6 gap-y-2 py-2 text-xs">
        <label className="flex items-center gap-2">
          <Switch defaultChecked aria-label="Password protection" />
          Password protection
        </label>
        <label className="flex items-center gap-2">
          <Switch defaultChecked aria-label="IP allowlist" />
          IP allowlist {demo.company.ipAllowlist}
        </label>
      </CellBody>
    </Cell>
  );
}
