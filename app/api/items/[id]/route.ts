import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { requireAdmin, resolveAuthContext } from "@/lib/auth";
import Item from "@/models/Item";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await connectDB();

    const { id } = await params;
    const auth = await resolveAuthContext(request);
    const query: Record<string, unknown> = { _id: id };

    if (auth && !auth.isAdmin && auth.userId) {
      query.userId = auth.userId;
    }

    const item = await Item.findOne(query);

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await connectDB();

    const { id } = await params;
    const auth = await resolveAuthContext(request);
    const updates = await request.json();

    // If price is updated, recalc tier
    if (updates.price !== undefined) {
      const { tierFromPrice } = await import('@/lib/tierFromPrice');
      updates.tier = tierFromPrice(Number(updates.price));
    }

    // If zone is changed to 'saving' and tier not provided, recalc from current price
    if (updates.zone === 'saving' && updates.tier === undefined) {
      const current = await Item.findById(id);
      if (current) {
        const { tierFromPrice } = await import('@/lib/tierFromPrice');
        updates.tier = tierFromPrice(Number(current.price));
      }
    }

    const query: Record<string, unknown> = { _id: id };
    if (auth && !auth.isAdmin && auth.userId) {
      query.userId = auth.userId;
    }

    const item = await Item.findOneAndUpdate(query, { $set: updates }, { new: true });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await connectDB();

    const { id } = await params;
    const auth = await resolveAuthContext(request);
    const query: Record<string, unknown> = { _id: id };
    if (auth && !auth.isAdmin && auth.userId) {
      query.userId = auth.userId;
    }

    const item = await Item.findOneAndUpdate(query, { $set: { status: 'removed' } }, { new: true });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
