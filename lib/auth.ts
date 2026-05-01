import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import User from "@/models/User";

const sessionCookieName = "wyse_session";
const sessionSecret = process.env.SESSION_SECRET ?? process.env.ADMIN_SECRET ?? "wyse-session-secret";

type AuthContext = {
  isAdmin: boolean;
  userId: string | null;
};

function sign(value: string) {
  return crypto.createHmac("sha256", sessionSecret).update(value).digest("hex");
}

export function createSessionToken(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token: string | undefined | null) {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  if (sign(payload) !== signature) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: string;
    };

    return typeof decoded.userId === "string" ? decoded.userId : null;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: sessionCookieName,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: sessionCookieName,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function resolveAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const provided = request.headers.get("x-admin-secret");
  const expected = process.env.ADMIN_SECRET;

  if (expected && provided === expected) {
    return { isAdmin: true, userId: null };
  }

  const token = request.cookies.get(sessionCookieName)?.value;
  const userId = parseSessionToken(token);
  if (!userId) return null;

  return { isAdmin: false, userId };
}

export async function getAuthenticatedUser(request: NextRequest) {
  const context = await resolveAuthContext(request);
  if (!context || context.isAdmin || !context.userId) return null;

  return User.findById(context.userId).select("_id username displayName");
}

export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const context = await resolveAuthContext(request);
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function getSessionCookieName() {
  return sessionCookieName;
}
