export const members = [
  {
    id: 1,
    name: "Maximilian Kaske",
    email: "max@openstatus.dev",
    role: "admin",
    createdAt: "2021-01-01",
  },
];

export type Member = (typeof members)[number];
