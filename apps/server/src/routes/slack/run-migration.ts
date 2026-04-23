import { migrateExistingInstallations } from "./migrate-installations";

migrateExistingInstallations()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Migration failed:", err);
		process.exit(1);
	});
