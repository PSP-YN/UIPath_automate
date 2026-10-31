import { NextResponse } from "next/server";
import type { ActorResult, WorkspaceActor } from "./auth/session";

export function actorErrorResponse(result: Exclude<ActorResult, { actor: WorkspaceActor }>) {
  return NextResponse.json(
    { error: result.error },
    {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | undefined> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 65536) return undefined;
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
