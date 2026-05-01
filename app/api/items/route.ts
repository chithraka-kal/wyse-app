import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import Item from "@/models/Item";

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await connectDB();

    const zone = request.nextUrl.searchParams.get("zone");
    const filter: Record<string, unknown> = { status: { $ne: "dropped" } };

    if (zone) {
      filter.zone = zone;
    }

    const items = await Item.find(filter).sort({ addedAt: -1 });
    return NextResponse.json(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await connectDB();

    const body = await request.json();
    if (body?.zone === "incubator") {
      const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      body.promoteAfter = inSevenDays;
    }

    const item = await Item.create(body);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
