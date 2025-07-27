export const maintenances = [
  {
    id: 1,
    title: "DB Migration",
    message:
      "We are currently performing a db migration on our system and will be down for a few hours.",
    startDate: new Date("2025-04-01"),
    endDate: new Date("2025-04-02"),
    affected: ["OpenStatus API"],
  },
];

export type Maintenance = (typeof maintenances)[number];
