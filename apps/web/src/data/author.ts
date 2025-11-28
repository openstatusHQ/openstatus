export const author = {
  "Maximilian Kaske": {
    name: "Maximilian Kaske",
    url: "https://x.com/mxkaske",
    image: "https://www.openstatus.dev/assets/authors/max.png",
  },
  "Thibault Le Ouay Ducasse": {
    name: "Thibault Le Ouay Ducasse",
    url: "https://bsky.app/profile/thibaultleouay.dev",
    image: "https://www.openstatus.dev/assets/authors/thibault.jpeg",
  },
} as const;

export function getAuthor(name: string) {
  if (name in author) {
    return author[name as keyof typeof author];
  }
  return name;
}
