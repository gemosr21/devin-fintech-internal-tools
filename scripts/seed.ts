import { loadEnvConfig } from "@next/env";
import { openDb } from "../lib/db";
import { seed } from "../lib/seed";

// Load .env files like `next dev` (default) or `next start` (NODE_ENV=production) so DATABASE_PATH matches the app.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const db = openDb();
seed(db);
const { n } = db.prepare("SELECT COUNT(*) AS n FROM refund_requests").get() as { n: number };
console.log(`Seeded ${n} synthetic refund requests into ${db.name}`);
db.close();
