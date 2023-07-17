import type { Blog } from "contentlayer/generated";

// return only what is needed for the index page
export const getDisplayBlogs = (allBlogs: Blog[]) => {
  return allBlogs
    .map((Blog) => {
      const { title, slug, publishedAtFormatted, readingTime, description } =
        Blog;

      return Object.fromEntries(
        Object.entries({
          title,
          slug,
          publishedAtFormatted,
          readingTime,
          description,
        }),
      );
    })
    .sort((a, b) => {
      const [yearA, monthA, dayA] = a.publishedAt.split("-").map(Number);
      const [yearB, monthB, dayB] = b.publishedAt.split("-").map(Number);
      if (yearB !== yearA) return yearB - yearA;
      if (monthB !== monthA) return monthB - monthA;
      return dayB - dayA;
    });
};
