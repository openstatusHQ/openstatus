import { Header } from "@/components/dashboard/header";
import { getPageBySegment } from "@/config/pages";

const page = getPageBySegment(["settings", "appearance"]);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header title={page?.title} description={page?.description} />
      {children}
    </>
  );
}
