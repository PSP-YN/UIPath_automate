import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonObject } from "@/lib/http";
import {
  buildActorFromEmail,
  signSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import type { WorkspaceRole } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(["owner", "admin", "reviewer", "member"]).optional(),
  name: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a valid email address to sign in." },
      { status: 400 },
    );
  }

  const { email, role, name } = parsed.data;
  const actor = buildActorFromEmail(email, (role as WorkspaceRole) || "reviewer", name);
  const token = await signSessionToken(actor);

  const response = NextResponse.json({
    ok: true,
    actor: {
      email: actor.user.email,
      name: actor.user.name,
      role: actor.role,
      workspaceName: actor.workspaceName,
    },
  });

  const isProduction = process.env.NODE_ENV === "production";
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}
