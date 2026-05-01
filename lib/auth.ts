import { NextRequest, NextResponse } from "next/server";

export function requireAdmin(request: NextRequest): NextResponse | null {
  const provided = request.headers.get("x-admin-secret");
  const expected = process.env.ADMIN_SECRET;

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
