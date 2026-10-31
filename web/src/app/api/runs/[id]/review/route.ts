import { NextResponse } from "next/server";
import { z } from "zod";
import { actorErrorResponse, readJsonObject } from "@/lib/http";
import { requireWorkspaceActor } from "@/lib/auth/session";
import { reviewWorkflowRun } from "@/lib/store/cases";

export const dynamic = "force-dynamic";

const reviewSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    note: z.string().max(1000).default(""),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceActor();
  if (!("actor" in access)) return actorErrorResponse(access);
  if (!["owner", "admin", "reviewer"].includes(access.actor.role)) {
    return NextResponse.json(
      { error: "A reviewer role is required to decide this case." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const runId = z.string().uuid().safeParse(id);
  if (!runId.success) {
    return NextResponse.json({ error: "Workflow case ID is invalid." }, { status: 400 });
  }

  const body = reviewSchema.safeParse(await readJsonObject(request));
  if (!body.success) {
    return NextResponse.json(
      { error: "Choose approve or reject and provide a note of 1,000 characters or fewer." },
      { status: 400 },
    );
  }

  try {
    const run = reviewWorkflowRun({
      runId: runId.data,
      decision: body.data.decision,
      note: body.data.note,
      actorEmail: access.actor.user.email,
      actorId: access.actor.user.id,
      workspaceId: access.actor.workspaceId,
    });

    return NextResponse.json(run, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_DECIDED") {
      return NextResponse.json(
        { error: "This case is no longer awaiting review." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Workflow case was not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("Workflow review failed", error);
    return NextResponse.json(
      { error: "The workflow decision could not be saved." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
