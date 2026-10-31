import { NextResponse } from "next/server";
import { actorErrorResponse } from "@/lib/http";
import { requireWorkspaceActor } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireWorkspaceActor();
  if (!("actor" in access)) return actorErrorResponse(access);

  return NextResponse.json(
    {
      email: access.actor.user.email,
      name: access.actor.user.name,
      role: access.actor.role,
      workspaceName: access.actor.workspaceName,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
