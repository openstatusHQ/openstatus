import { ContentLayout } from "../../content/layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ContentLayout>{children}</ContentLayout>;
}
