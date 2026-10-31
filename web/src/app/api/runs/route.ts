import { NextResponse } from "next/server";
import { z } from "zod";
import { actorErrorResponse, readJsonObject } from "@/lib/http";
import { analyzeWorkflow, validateWorkflowInput } from "@/lib/workflow-engine";
import type { WorkflowStatus } from "@/lib/database.types";
import { requireWorkspaceActor } from "@/lib/auth/session";
import { listWorkflowRuns, submitWorkflowRun } from "@/lib/store/cases";

export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    workflowId: z.string().min(1).max(80),
    input: z.record(z.string(), z.unknown()),
  })
  .strict();

const idempotencySchema = z.string().uuid();
const workflowStatuses = [
  "pending_review",
  "approved",
  "rejected",
  "failed",
] satisfies WorkflowStatus[];

export async function GET(request: Request) {
  const access = await requireWorkspaceActor();
  if (!("actor" in access)) return actorErrorResponse(access);

  const statusParam = new URL(request.url).searchParams.get("status");
  const status = statusParam
    ? z.enum(workflowStatuses).safeParse(statusParam)
    : undefined;
  if (status && !status.success) {
    return NextResponse.json({ error: "Unknown workflow status." }, { status: 400 });
  }

  const runs = listWorkflowRuns({
    status: status?.data,
    workspaceId: access.actor.workspaceId,
  });

  return NextResponse.json(runs, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await requireWorkspaceActor();
  if (!("actor" in access)) return actorErrorResponse(access);

  const rawKey = request.headers.get("idempotency-key") || request.headers.get("Idempotency-Key");
  const key = idempotencySchema.safeParse(rawKey);
  if (!key.success) {
    return NextResponse.json(
      { error: "A valid Idempotency-Key UUID header is required." },
      { status: 400 },
    );
  }

  const body = await readJsonObject(request);
  const parsedBody = requestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Provide a workflow ID and an object of workflow fields." },
      { status: 400 },
    );
  }

  const validated = validateWorkflowInput(
    parsedBody.data.workflowId,
    parsedBody.data.input,
  );
  if (!validated.success) {
    return NextResponse.json(
      { error: "Check the highlighted workflow fields.", fields: validated.errors },
      { status: 422 },
    );
  }

  let analysis;
  try {
    analysis = analyzeWorkflow(parsedBody.data.workflowId, validated.data);
  } catch (error) {
    if (error instanceof Error && error.message === "Choose a listed workflow before analysis.") {
      return NextResponse.json({ error: "Choose a listed workflow." }, { status: 400 });
    }
    console.error("Workflow analysis failed", error);
    return NextResponse.json(
      { error: "Workflow analysis is temporarily unavailable." },
      { status: 503 },
    );
  }

  try {
    const { run } = submitWorkflowRun({
      idempotencyKey: key.data,
      templateId: parsedBody.data.workflowId,
      input: validated.data,
      analysis,
      actorEmail: access.actor.user.email,
      actorId: access.actor.user.id,
      workspaceId: access.actor.workspaceId,
    });

    return NextResponse.json(run, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "IDEMPOTENCY_CONFLICT") {
      return NextResponse.json(
        { error: "This request key was already used with different input. Start a new submission." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("Workflow submission failed", error);
    return NextResponse.json(
      { error: "Workflow case could not be saved. You can retry with the same request key." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
