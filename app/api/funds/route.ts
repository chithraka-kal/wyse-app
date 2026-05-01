import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import Fund from "@/models/Fund";

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await connectDB();

    const funds = await Fund.find({})
      .sort({ receivedAt: -1 })
      .populate("allocations.itemId");

    return NextResponse.json(funds);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch funds";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await connectDB();

    const body = await request.json();
    const amount = Number(body?.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    const fund = await Fund.create({
      amount,
      source: body?.source || "manual",
      unallocated: amount,
    });

    return NextResponse.json(fund, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create fund";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
