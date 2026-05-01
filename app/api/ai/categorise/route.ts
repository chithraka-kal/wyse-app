import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { askGemini } from "@/lib/gemini";
import AgentLog from "@/models/AgentLog";

type CategoriseResult = {
  name: string;
  price: number;
  priority: 1 | 2 | 3;
  zone: "wishlist" | "saving";
};

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  await connectDB();

  const body = await request.json();

  const prompt = `The user pasted this text: "${body?.rawInput}"\n\nExtract the product name, estimate a realistic market price in LKR, and suggest a priority (1 = urgent, 2 = normal, 3 = low).\nAlso suggest zone: "wishlist" (impulse/new desire) or "saving" (actively saving for it).\n\nReturn ONLY valid JSON - no explanation, no markdown:\n{ "name": "...", "price": number, "priority": 1|2|3, "zone": "wishlist"|"saving" }`;

  try {
    const result = await askGemini(prompt);

    if (!result) {
      await AgentLog.create({
        type: "categorise",
        itemId: null,
        prompt,
        response: "Gemini unavailable",
        success: false,
      });

      return NextResponse.json(
        { result: null, aiAvailable: false, message: "AI unavailable" },
        { status: 200 },
      );
    }

    try {
      const parsed = JSON.parse(result) as CategoriseResult;

      await AgentLog.create({
        type: "categorise",
        itemId: null,
        prompt,
        response: result,
        success: true,
      });

      return NextResponse.json({ result: parsed, aiAvailable: true });
    } catch {
      await AgentLog.create({
        type: "categorise",
        itemId: null,
        prompt,
        response: result,
        success: false,
      });

      return NextResponse.json(
        { result: null, aiAvailable: false, message: "AI returned invalid JSON" },
        { status: 200 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await AgentLog.create({
      type: "categorise",
      itemId: null,
      prompt,
      response: message,
      success: false,
    });

    return NextResponse.json(
      { result: null, aiAvailable: false, message: "AI unavailable" },
      { status: 200 },
    );
  }
}
