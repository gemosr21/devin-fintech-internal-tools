import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { tempDbPath } from "./helpers";

// Route handlers are exercised directly with raw requests, i.e. bypassing the UI entirely.
let decision: typeof import("../app/api/refunds/[id]/decision/route");
let list: typeof import("../app/api/refunds/route");
let detail: typeof import("../app/api/refunds/[id]/route");

beforeAll(async () => {
  process.env.DATABASE_PATH = tempDbPath();
  decision = await import("../app/api/refunds/[id]/decision/route");
  list = await import("../app/api/refunds/route");
  detail = await import("../app/api/refunds/[id]/route");
});

function post(id: string, body: unknown, user?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (user) headers.cookie = `demo_user=${user}`;
  const req = new NextRequest(`http://localhost/api/refunds/${id}/decision`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return decision.POST(req, { params: Promise.resolve({ id }) });
}

async function get(id: string, user = "vera") {
  const req = new NextRequest(`http://localhost/api/refunds/${id}`, { headers: { cookie: `demo_user=${user}` } });
  return (await detail.GET(req, { params: Promise.resolve({ id }) })).json();
}

describe("POST /api/refunds/:id/decision", () => {
  it("AC2: forbidden direct requests return 401/403 and write nothing", async () => {
    expect((await post("RF-1001", { decision: "approve", reason: "x" })).status).toBe(401);
    expect((await post("RF-1001", { decision: "approve", reason: "x" }, "mallory")).status).toBe(401);
    expect((await post("RF-1001", { decision: "approve", reason: "x" }, "vera")).status).toBe(403);
    expect((await post("RF-1001", { decision: "approve", reason: "x" }, "ada")).status).toBe(403);
    const body = await get("RF-1001");
    expect(body.refund.status).toBe("pending");
    expect(body.audit).toHaveLength(0);
  });

  it("AC3: invalid input returns 400", async () => {
    expect((await post("RF-1001", { decision: "approve", reason: "" }, "riley")).status).toBe(400);
    expect((await post("RF-1001", "not json", "riley")).status).toBe(400);
  });

  it("AC1/AC4/AC5: reviewer decides once (200), second attempt is 409, one audit event", async () => {
    const ok = await post("RF-1001", { decision: "approve", reason: "Verified duplicate" }, "riley");
    expect(ok.status).toBe(200);
    expect((await ok.json()).status).toBe("approved");
    const again = await post("RF-1001", { decision: "reject", reason: "changed mind" }, "rana");
    expect(again.status).toBe(409);
    const body = await get("RF-1001");
    expect(body.refund).toMatchObject({ status: "approved", decided_by: "riley" });
    expect(body.audit).toHaveLength(1);
  });

  it("returns 404 for unknown refunds", async () => {
    expect((await post("RF-9999", { decision: "approve", reason: "x" }, "riley")).status).toBe(404);
  });
});

describe("GET /api/refunds", () => {
  it("lists with a status filter for a recognized identity and denies anonymous reads", async () => {
    const res = await list.GET(new NextRequest("http://localhost/api/refunds?status=rejected", { headers: { cookie: "demo_user=vera" } }));
    const rows = await res.json();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r: { status: string }) => r.status === "rejected")).toBe(true);
    expect((await list.GET(new NextRequest("http://localhost/api/refunds"))).status).toBe(401);
  });
});
