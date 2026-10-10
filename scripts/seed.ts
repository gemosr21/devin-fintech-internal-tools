import { openDb } from "../lib/db";
import { seed } from "../lib/seed";

const db = openDb();
seed(db);
const { n } = db.prepare("SELECT COUNT(*) AS n FROM refund_requests").get() as { n: number };
console.log(`Seeded ${n} synthetic refund requests into ${db.name}`);
db.close();
