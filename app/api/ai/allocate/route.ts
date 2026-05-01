import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { askGemini } from "@/lib/gemini";
import AgentLog from "@/models/AgentLog";

type Allocation = {
  itemId: string;
  amount: number;
};

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  await connectDB();

  const body = await request.json();
  const itemList = Array.isArray(body?.items)
    ? body.items
        .map(
          (item: {
            _id: string;
            name: string;
            price: number;
            funded: number;
            tier: string;
          }) => `${item._id} | ${item.name} | ${item.price} | ${item.funded} | ${item.tier}`,
        )
        .join("\n")
    : "";

  const prompt = `You are a savings allocation strategist. The user just received ${body?.amount} in unallocated funds.\n\nTheir Definite Pipeline items (itemId | name | price | already funded | tier):\n${itemList}\n\nRules:\n1. Prioritise completing items that are closest to 100% funded first (psychological win).\n2. Distribute the remainder toward High-tier items.\n3. Never allocate to Incubator items.\n4. Return ONLY a JSON array: [{ "itemId": "...", "amount": number }, ...]\n5. Total of all amounts must exactly equal ${body?.amount}.`;

  try {
    const result = await askGemini(prompt);

    if (!result) {
      await AgentLog.create({
        type: "allocate",
        itemId: null,
        prompt,
        response: "Gemini unavailable",
        success: false,
      });

      return NextResponse.json(
        { result: [], aiAvailable: false, message: "AI unavailable. Fill manually." },
        { status: 200 },
      );
    }

    try {
      const parsed = JSON.parse(result) as Allocation[];

      await AgentLog.create({
        type: "allocate",
        itemId: null,
        prompt,
        response: result,
        success: true,
      });

      return NextResponse.json({ result: parsed, aiAvailable: true });
    } catch {
      await AgentLog.create({
        type: "allocate",
        itemId: null,
        prompt,
        response: result,
        success: false,
      });

      return NextResponse.json(
        { result: [], aiAvailable: false, message: "AI returned invalid JSON. Fill manually." },
        { status: 200 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await AgentLog.create({
      type: "allocate",
      itemId: null,
      prompt,
      response: message,
      success: false,
    });

    return NextResponse.json(
      { result: [], aiAvailable: false, message: "AI unavailable. Fill manually." },
      { status: 200 },
    );
  }
}
