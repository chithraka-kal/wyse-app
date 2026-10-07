import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { requireAdmin, resolveAuthContext } from "@/lib/auth";
import Board from "@/models/Board";
import Item from "@/models/Item";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await connectDB();
    const auth = await resolveAuthContext(request);
    
    if (!auth || !auth.userId) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const board = await Board.findOne({ _id: id });
    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    if (!auth.isAdmin && board.userId.toString() !== auth.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Unassign items from this board
    await Item.updateMany({ boardId: id }, { $set: { boardId: null, boardOrder: 0 } });
    await Board.deleteOne({ _id: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete board";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
