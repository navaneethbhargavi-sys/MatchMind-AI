// src/app/api/live/matches/route.ts
import { NextResponse } from "next/server";
import { getLiveMatches } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const matches = await getLiveMatches();
    return NextResponse.json({ matches });
  } catch (error) {
    return NextResponse.json(
      { matches: [], error: error instanceof Error ? error.message : "Live provider unreachable" },
      { status: 200 },
    );
  }
}
