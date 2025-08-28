const today = new Date();
const week = new Date(today);
week.setDate(week.getDate() + 7);
const hour = new Date(week);
hour.setHours(hour.getHours() + 1);

export const maintenances = [
  {
    id: 1,
    title: "DB Migration",
    message:
      "We are performing a db migration on our system and will be down for a an hour.",
    startDate: week,
    endDate: hour,
    affected: ["OpenStatus API"],
  },
  {
    id: 2,
    title: "System Upgrade",
    message:
      "We will be upgrading our core infrastructure to improve performance and reliability. Service interruptions may occur.",
    startDate: new Date("2025-03-01 11:00:00"),
    endDate: new Date("2025-03-01 15:30:00"),
    affected: ["OpenStatus API", "OpenStatus Web"],
  },
];

export type Maintenance = (typeof maintenances)[number];
