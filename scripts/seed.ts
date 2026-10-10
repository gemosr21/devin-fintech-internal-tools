import { loadEnvConfig } from "@next/env";
import { openDb } from "../lib/db";
import { seed } from "../lib/seed";

// Load .env / .env.local the same way `next dev`/`next start` do, so DATABASE_PATH matches the app.
loadEnvConfig(process.cwd());

const db = openDb();
seed(db);
const { n } = db.prepare("SELECT COUNT(*) AS n FROM refund_requests").get() as { n: number };
console.log(`Seeded ${n} synthetic refund requests into ${db.name}`);
db.close();
