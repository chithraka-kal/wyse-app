import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { requireAdmin, resolveAuthContext } from "@/lib/auth";
import Board from "@/models/Board";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await connectDB();
    const auth = await resolveAuthContext(request);

    if (!auth || !auth.userId) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const filter: Record<string, unknown> = {};
    if (!auth.isAdmin) {
      filter.userId = auth.userId;
    }

    const boards = await Board.find(filter).sort({ createdAt: 1 });
    return NextResponse.json(boards);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch boards";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await connectDB();
    const auth = await resolveAuthContext(request);

    if (!auth || !auth.userId) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const board = await Board.create({
      name: body.name,
      userId: auth.userId,
    });
    
    return NextResponse.json(board, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create board";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
