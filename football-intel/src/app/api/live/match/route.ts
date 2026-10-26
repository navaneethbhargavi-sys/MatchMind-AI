// src/app/api/live/match/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getLiveMatchDetail } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const matchId = request.nextUrl.searchParams.get("id");
  if (!matchId) {
    return NextResponse.json({ error: "id query parameter is required" }, { status: 400 });
  }
  try {
    const detail = await getLiveMatchDetail(matchId);
    return NextResponse.json({ match: detail });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Live provider unreachable" },
      { status: 502 },
    );
  }
}
