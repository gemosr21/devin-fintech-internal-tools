import type Database from "better-sqlite3";

export const DEMO_USERS = [
  { id: "vera", name: "Vera Viewer", role: "viewer" },
  { id: "riley", name: "Riley Reviewer", role: "reviewer" },
  { id: "rana", name: "Rana Reviewer", role: "reviewer" },
  { id: "ada", name: "Ada Admin", role: "admin" },
] as const;

const FIRST = ["Alex", "Sam", "Jordan", "Taylor", "Morgan", "Casey", "Jamie", "Robin", "Drew", "Quinn"];
const LAST = ["Nguyen", "Okafor", "Silva", "Kowalski", "Haddad", "Larsen", "Tanaka", "Moreau"];
const MERCHANTS = ["Acme Coffee", "Northwind Travel", "Globex Electronics", "Initech SaaS", "Umbrella Pharmacy"];
const REASONS = [
  "Duplicate charge",
  "Item not received",
  "Subscription cancelled but still billed",
  "Service not as described",
  "Unrecognized transaction",
];

export function seed(db: Database.Database) {
  const run = db.transaction(() => {
    db.exec("DROP TRIGGER IF EXISTS audit_events_no_delete");
    db.exec("DELETE FROM audit_events; DELETE FROM refund_requests; DELETE FROM users;");
    db.exec(`CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events
      BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;`);
    const insUser = db.prepare("INSERT INTO users (id, name, role) VALUES (?, ?, ?)");
    for (const u of DEMO_USERS) insUser.run(u.id, u.name, u.role);

    const insRefund = db.prepare(`INSERT INTO refund_requests
      (id, customer_name, customer_email, merchant, amount_cents, currency, request_reason, created_at,
       status, decided_by, decided_at, decision_reason)
      VALUES (?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?)`);
    const base = Date.UTC(2026, 8, 1);
    for (let i = 1; i <= 24; i++) {
      const first = FIRST[i % FIRST.length];
      const last = LAST[(i * 3) % LAST.length];
      const status = i % 4 === 0 ? "approved" : i % 6 === 0 ? "rejected" : "pending";
      const decided = status !== "pending";
      insRefund.run(
        `RF-${String(1000 + i)}`,
        `${first} ${last}`,
        `${first}.${last}@example.test`.toLowerCase(),
        MERCHANTS[i % MERCHANTS.length],
        ((i * 7919) % 50000) + 500,
        REASONS[i % REASONS.length],
        new Date(base + i * 36e5 * 9).toISOString(),
        status,
        decided ? "rana" : null,
        decided ? new Date(base + i * 36e5 * 9 + 36e5).toISOString() : null,
        decided ? "Seeded historical decision" : null,
      );
    }
  });
  run();
}
