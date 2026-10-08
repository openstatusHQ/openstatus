"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useParams } from "next/navigation";

import { DeclareIncidentButton } from "@/components/incidents/declare-incident-button";
import { NavFeedback } from "@/components/nav/nav-feedback";

export function NavActions() {
  const params = useParams<{ id?: string }>();
  // The layout also wraps /incidents/[id]; the detail page has its own actions.
  const isList = !params.id;

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      {isList ? (
        <DeclareIncidentButton>
          <Button size="sm">Declare incident</Button>
        </DeclareIncidentButton>
      ) : null}
    </div>
  );
}
