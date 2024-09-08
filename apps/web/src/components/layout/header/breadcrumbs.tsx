"use client";

import { Slash } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  useParams,
} from "next/navigation";
import { Fragment } from "react";

import { SelectWorkspace } from "@/components/workspace/select-workspace";
import { notEmpty } from "@/lib/utils";

export function Breadcrumbs() {
  const params = useParams();
  // const selectedSegment = useSelectedLayoutSegment();
  // const selectedSegments = useSelectedLayoutSegments();
  // const label = useIdLabel();

  // // remove route groups like '(overview)' from the segments
  // const segmentsWithoutRouteGroup = selectedSegments.filter(
  //   (segment) => !segment.startsWith("("),
  // );

  // const isRoot = segmentsWithoutRouteGroup.length <= 1;

  // const page = pagesConfig.find(({ segment }) => segment === selectedSegment);
  const breadcrumbs = [
    // !isRoot ? page?.title : null,
    // label,
  ].filter(notEmpty);

  const _isWorkspaceSlug = params.workspaceSlug;

  return (
    <div className="flex items-center">
      <Link href="/app" className="shrink-0">
        <Image
          src="/icon.png"
          alt="OpenStatus"
          height={30}
          width={30}
          className="rounded-full border border-border"
        />
      </Link>
      <Slash className="-rotate-12 mr-0.5 ml-2.5 h-4 w-4 text-muted-foreground" />
      {params.workspaceSlug ? (
        <div className="w-40">
          <SelectWorkspace />
        </div>
      ) : null}
      {breadcrumbs.map((breadcrumb) => (
        <Fragment key={breadcrumb}>
          <Slash className="-rotate-12 mr-2.5 ml-0.5 h-4 w-4 text-muted-foreground" />
          <p className="rounded-md font-medium text-primary text-sm">
            {breadcrumb}
          </p>
        </Fragment>
      ))}
    </div>
  );
}
