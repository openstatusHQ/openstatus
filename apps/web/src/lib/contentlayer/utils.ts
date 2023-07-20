import type { Post } from "contentlayer/generated";

// return only what is needed for the index page
export const getDisplayPosts = (allPosts: Post[]) => {
  return allPosts
    .map((Post) => {
      const {
        title,
        slug,
        author,
        authorLink,
        publishedAt,
        publishedAtFormatted,
        readingTime,
        description,
      } = Post;

      return Object.fromEntries(
        Object.entries({
          title,
          description,
          author,
          authorLink,
          publishedAt,
          publishedAtFormatted,
          slug,
          readingTime,
        }),
      );
    })
    .sort((a, b) => {
      console.log(a.publishedAt);
      console.log(a.publishedAtFormatted);
      const date1 = new Date(a.publishedAt).getTime();
      const date2 = new Date(b.publishedAt).getTime();

      return date2 - date1;
    });
};
