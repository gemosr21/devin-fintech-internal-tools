import { NextResponse, type NextRequest } from "next/server";
import { DEMO_IDENTITY_COOKIE } from "@/lib/identity";

// Demo identity switcher. NOT authentication: anyone can set any identity.
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const userId = String(form.get("userId") ?? "");
  const back = String(form.get("returnTo") ?? "/refunds");
  const res = NextResponse.redirect(new URL(back.startsWith("/") ? back : "/refunds", request.url), 303);
  if (userId) res.cookies.set(DEMO_IDENTITY_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/" });
  else res.cookies.delete(DEMO_IDENTITY_COOKIE);
  return res;
}
