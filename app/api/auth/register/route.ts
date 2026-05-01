import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import User from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const username = String(body?.username ?? "").trim().toLowerCase();
    const displayName = String(body?.displayName ?? "").trim();
    const password = String(body?.password ?? "");

    if (!username || !displayName || !password) {
      return NextResponse.json(
        { error: "Display name, username, and password are required" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    const { salt, hash } = hashPassword(password);
    const user = await User.create({
      username,
      displayName,
      passwordSalt: salt,
      passwordHash: hash,
    });

    const response = NextResponse.json({
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
      },
    });

    setSessionCookie(response, createSessionToken(String(user._id)));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to register";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
