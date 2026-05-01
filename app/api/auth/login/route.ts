import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import User from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const username = String(body?.username ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const valid = verifyPassword(password, user.passwordSalt, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

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
    const message = error instanceof Error ? error.message : "Failed to log in";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
