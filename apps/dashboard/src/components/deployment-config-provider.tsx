"use client";

import { createContext, useContext } from "react";

import {
  DEFAULT_DEPLOYMENT_CONFIG,
  type DeploymentConfig,
} from "@/lib/deployment-config";

// Set from the root server layout: the values are runtime server envs, which
// a prebuilt client bundle cannot read from `process.env`.
const DeploymentConfigContext = createContext<DeploymentConfig>(
  DEFAULT_DEPLOYMENT_CONFIG,
);

export function DeploymentConfigProvider({
  value,
  children,
}: {
  value: DeploymentConfig;
  children: React.ReactNode;
}) {
  return (
    <DeploymentConfigContext.Provider value={value}>
      {children}
    </DeploymentConfigContext.Provider>
  );
}

export function useDeploymentConfig(): DeploymentConfig {
  return useContext(DeploymentConfigContext);
}

export function useStatusPageBaseDomain(): string {
  return useContext(DeploymentConfigContext).statusPageBaseDomain;
}
