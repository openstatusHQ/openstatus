import { CustomMDX } from "@/content/mdx";
import { getHomePage } from "@/content/utils";

export default function Page() {
  const homePage = getHomePage();
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>{homePage.metadata.title}</h1>
      <p className="text-lg text-muted-foreground">
        {homePage.metadata.description}
      </p>
      <CustomMDX source={homePage.content} />
    </div>
  );
}
