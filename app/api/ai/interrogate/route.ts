import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { askGemini } from "@/lib/gemini";
import AgentLog from "@/models/AgentLog";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  await connectDB();

  const body = await request.json();
  const prompt = `You are a financial discipline assistant. A user has added an item to their wishlist.\n\nItem: "${body?.name}"\nPrice: LKR ${body?.price}\nTheir current Big-tier savings goal: "${body?.highTierGoal}" at ${body?.highTierProgress}% funded.\n\nAsk ONE sharp, non-judgmental question that makes them justify this purchase logically.\nThe question must be under 30 words. Do not lecture. Just ask the question.`;

  try {
    const result = await askGemini(prompt);

    if (!result) {
      const fallback = "What practical problem does this item solve that your current setup cannot?";
      await AgentLog.create({
        type: "interrogate",
        itemId: body?.itemId || null,
        prompt,
        response: fallback,
        success: false,
      });

      return NextResponse.json({ result: fallback, aiAvailable: false });
    }

    await AgentLog.create({
      type: "interrogate",
      itemId: body?.itemId || null,
      prompt,
      response: result,
      success: true,
    });

    return NextResponse.json({ result, aiAvailable: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const fallback = "What practical problem does this item solve that your current setup cannot?";

    await AgentLog.create({
      type: "interrogate",
      itemId: body?.itemId || null,
      prompt,
      response: message,
      success: false,
    });

    return NextResponse.json({ result: fallback, aiAvailable: false });
  }
}
