import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // Minimal session endpoint to avoid HTML 404 responses when the frontend
  // calls /api/auth/session. This returns an empty session object — replace
  // with a proper NextAuth session proxy if you need full auth integration.
  return NextResponse.json({ ok: true, session: null });
}
