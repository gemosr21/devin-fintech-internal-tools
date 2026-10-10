import Database from "better-sqlite3";

export const dynamic = "force-dynamic";

export default function Home() {
  const db = new Database(":memory:");
  const row = db.prepare("select sqlite_version() as v").get() as { v: string };
  return <main>SQLite {row.v}</main>;
}
