// src/app/api/narrate/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { events, state, mode, language } = body;

  const homeScore = state?.homeScore ?? 0;
  const awayScore = state?.awayScore ?? 0;
  const minute = state?.minute ?? 0;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const text = `Match update at minute ${minute}: ${state?.homeTeam ?? "Home"} ${homeScore} - ${awayScore} ${state?.awayTeam ?? "Away"}. ${events?.length ?? 0} events processed so far.`;
    return NextResponse.json({ narrative: text, type: "play_by_play" });
  }

  const recentEvents = (events || []).slice(-15).map((e: any) => ({
    minute: Math.floor(e.timestamp / 60),
    type: e.type,
    team: e.team,
    player: e.player,
    metadata: e.metadata,
  }));

  const prompt = `You are a football match commentator. Generate a concise, engaging narrative for the following match state.

Match: ${state?.homeTeam ?? "Home"} ${homeScore} - ${awayScore} ${state?.awayTeam ?? "Away"} (Minute ${minute})
Recent events: ${JSON.stringify(recentEvents)}

Viewer mode: ${mode || "fan"} (analyst = detailed stats, fan = exciting, casual = simple, player_focus = player-centric)
Language: ${language || "en"}

Generate a 2-3 sentence narrative that explains what's happening and why it matters. Be specific and engaging.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
      }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "Match in progress.";
    return NextResponse.json({ narrative: text, type: "play_by_play" });
  } catch {
    const text = `Match update at minute ${minute}: ${state?.homeTeam} ${homeScore} - ${awayScore} ${state?.awayTeam}.`;
    return NextResponse.json({ narrative: text, type: "play_by_play" });
  }
}