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
    const filter: Record<string, unknown> = { status: { $ne: "removed" } };

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
    // zone defaults to 'wishlist'
    const zone = body?.zone ?? 'wishlist';
    const priority = body?.priority ?? 2;
    // auto-calc tier from price
    const { tierFromPrice } = await import('@/lib/tierFromPrice');
    const tier = tierFromPrice(Number(body.price));

    const item = await Item.create({
      name: body.name,
      price: body.price,
      funded: body.funded ?? 0,
      zone,
      priority,
      tier,
      status: body.status ?? 'active',
      notes: body.notes ?? '',
      url: body.url ?? '',
      imageUrl: body.imageUrl ?? '',
      aiSuggested: body.aiSuggested ?? false,
      tags: body.tags ?? [],
      addedAt: body.addedAt ?? undefined,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
