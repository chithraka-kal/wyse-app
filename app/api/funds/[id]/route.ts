import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import Fund from "@/models/Fund";
import Item from "@/models/Item";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type AllocationInput = {
  itemId: string;
  amount: number;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();
    const allocations: AllocationInput[] = Array.isArray(body?.allocations)
      ? body.allocations
      : [];

    if (allocations.length === 0) {
      return NextResponse.json({ error: "Allocations are required" }, { status: 400 });
    }

    const fund = await Fund.findById(id);
    if (!fund) {
      return NextResponse.json({ error: "Fund not found" }, { status: 404 });
    }

    const total = allocations.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    if (total > fund.unallocated) {
      return NextResponse.json(
        { error: "Allocations exceed unallocated amount" },
        { status: 400 },
      );
    }

    for (const allocation of allocations) {
      const amount = Number(allocation.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "Each allocation amount must be a positive number" },
          { status: 400 },
        );
      }

      const item = await Item.findByIdAndUpdate(
        allocation.itemId,
        { $inc: { funded: amount } },
        { new: true },
      );

      if (!item) {
        return NextResponse.json({ error: `Item not found: ${allocation.itemId}` }, { status: 404 });
      }

      if (item.funded >= item.price && item.status !== "done") {
        item.status = "done";
        await item.save();
      }

      fund.allocations.push({ itemId: allocation.itemId, amount });
      fund.unallocated -= amount;
    }

    await fund.save();
    await fund.populate("allocations.itemId");

    return NextResponse.json(fund);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to allocate fund";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
