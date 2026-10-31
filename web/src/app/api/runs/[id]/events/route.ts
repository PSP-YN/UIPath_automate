import { NextResponse } from "next/server";
import { z } from "zod";
import { actorErrorResponse } from "@/lib/http";
import { requireWorkspaceActor } from "@/lib/auth/session";
import { listWorkflowEvents } from "@/lib/store/cases";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceActor();
  if (!("actor" in access)) return actorErrorResponse(access);

  const { id } = await params;
  const runId = z.string().uuid().safeParse(id);
  if (!runId.success) {
    return NextResponse.json({ error: "Workflow case ID is invalid." }, { status: 400 });
  }

  const events = listWorkflowEvents(runId.data, access.actor.workspaceId);
  return NextResponse.json(events, { headers: { "Cache-Control": "no-store" } });
}
