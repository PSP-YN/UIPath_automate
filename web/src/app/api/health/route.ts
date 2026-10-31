import { NextResponse } from "next/server";
import { listWorkflowRuns } from "@/lib/store/cases";

export const dynamic = "force-dynamic";

export async function GET() {
  const activeCases = listWorkflowRuns();
  return NextResponse.json(
    {
      status: "ok",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "production",
      timestamp: new Date().toISOString(),
      activeCasesCount: activeCases.length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
