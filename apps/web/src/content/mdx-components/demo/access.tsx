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
import { useId } from "react";

import { demo, getMonitors } from "@/data/demo-data";

import {
  Cell,
  CellBody,
  CellDescription,
  CellGrid,
  CellHeader,
  CellPane,
  CellTitle,
} from "./cell";

/** Same workspace, two audiences: the public page and the gated internal one. */
export function AccessDemo() {
  const id = useId();
  return (
    <Cell>
      <CellGrid cols={1} sm={2}>
        <CellPane>
          <CellHeader>
            <CellTitle>{demo.company.domain}</CellTitle>
            <CellDescription>public</CellDescription>
          </CellHeader>
          <CellBody className="flex flex-col gap-3">
            {getMonitors().map((c) => (
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
        </CellPane>
        <CellPane>
          <CellHeader>
            <CellTitle>{demo.company.internalDomain}</CellTitle>
            <CellDescription>password · IP allowlist</CellDescription>
          </CellHeader>
          <CellBody className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <CellTitle>Protected Page</CellTitle>
              <CellDescription>
                Enter the password to access the status page.
              </CellDescription>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-password`}>Password</Label>
              <Input
                id={`${id}-password`}
                type="password"
                defaultValue={demo.company.internalPassword}
                readOnly
              />
            </div>
            <Button type="button" className="w-full">
              Submit
            </Button>
          </CellBody>
        </CellPane>
      </CellGrid>
      <CellBody className="flex flex-wrap gap-x-6 gap-y-2 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Switch id={`${id}-password-protection`} defaultChecked />
          <Label htmlFor={`${id}-password-protection`}>
            Password protection
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id={`${id}-ip-allowlist`} defaultChecked />
          <Label htmlFor={`${id}-ip-allowlist`}>
            IP allowlist {demo.company.ipAllowlist}
          </Label>
        </div>
      </CellBody>
    </Cell>
  );
}
