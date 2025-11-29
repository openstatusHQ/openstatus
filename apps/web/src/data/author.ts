export const author = {
  "Maximilian Kaske": {
    name: "Maximilian Kaske",
    url: "https://x.com/mxkaske",
    image: "/assets/authors/max.png",
  },
  "Thibault Le Ouay Ducasse": {
    name: "Thibault Le Ouay Ducasse",
    url: "https://bsky.app/profile/thibaultleouay.dev",
    image: "/assets/authors/thibault.jpeg",
  },
} as const;

export function getAuthor(name: string) {
  if (name in author) {
    return author[name as keyof typeof author];
  }
  return name;
}
