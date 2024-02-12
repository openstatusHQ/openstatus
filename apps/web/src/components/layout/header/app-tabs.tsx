import { useParams, useSelectedLayoutSegment } from "next/navigation";

import { TabsContainer, TabsLink } from "@/components/dashboard/tabs-link";
import { pagesConfig } from "@/config/pages";

export function AppTabs() {
  const params = useParams();
  const selectedSegment = useSelectedLayoutSegment();

  return (
    <TabsContainer hideSeparator>
      {pagesConfig.map(({ title, segment }) => {
        const active = segment === selectedSegment;
        return (
          <TabsLink
            key={title}
            active={active}
            href={`/app/${params?.workspaceSlug}/${segment}`}
          >
            {title}
          </TabsLink>
        );
      })}
    </TabsContainer>
  );
}
