// src/app/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { generateMatchEvents } from "@/lib/events";
import { computeMatchState, computePlayerStats, computeTeamStats, detectKeyMoments } from "@/lib/stats";
import { generateInsights, explainMoment } from "@/lib/insights";
import { Event, MatchState, ViewerPrefs, Insight, PlayerStats } from "@/lib/types";
import {
  describeLiveMatch,
  liveEventsToAppEvents,
  liveMatchState,
  type LiveMatchDetailJson,
  type LiveMatchSummaryJson,
} from "@/lib/live";
import { Send, Settings, Eye, BarChart3, MessageSquare, Zap, User, Radio } from "lucide-react";

const ALL_EVENTS = generateMatchEvents(120);

export default function MatchPage() {
  const [eventIndex, setEventIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [prefs, setPrefs] = useState<ViewerPrefs>({ mode: "fan", language: "en" });
  const [showSettings, setShowSettings] = useState(false);
  const [narrative, setNarrative] = useState("");
  const [loadingNarrative, setLoadingNarrative] = useState(false);

  // Live Premier League state (real data via ESPN, no API key required)
  const [liveMatches, setLiveMatches] = useState<LiveMatchSummaryJson[]>([]);
  const [liveMatchesError, setLiveMatchesError] = useState<string | null>(null);
  const [selectedLiveId, setSelectedLiveId] = useState<string | null>(null);
  const [liveDetail, setLiveDetail] = useState<LiveMatchDetailJson | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState(true);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load the real fixture list and auto-select the most interesting match
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/live/matches");
        const data = await res.json();
        if (cancelled) return;
        setLiveMatches(data.matches ?? []);
        setLiveMatchesError(data.error ?? null);
        setSelectedLiveId((current) => {
          if (current) return current;
          const live = (data.matches ?? []).find((m: LiveMatchSummaryJson) => m.status.state === "in");
          if (live) return live.id;
          const upcoming = (data.matches ?? []).find((m: LiveMatchSummaryJson) => m.status.state === "pre");
          return upcoming?.id ?? (data.matches ?? [])[0]?.id ?? null;
        });
      } catch (error) {
        if (!cancelled) setLiveMatchesError(error instanceof Error ? error.message : "Live provider unreachable");
      }
    };
    void load();
    const timer = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  // Poll the selected real match every 15 seconds while live mode is on
  useEffect(() => {
    if (!liveMode || !selectedLiveId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/live/match?id=${encodeURIComponent(selectedLiveId)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.match) { setLiveDetail(data.match); setLiveError(null); }
        else setLiveError(data.error ?? "Match unavailable");
      } catch (error) {
        if (!cancelled) setLiveError(error instanceof Error ? error.message : "Live provider unreachable");
      }
    };
    void load();
    const timer = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [liveMode, selectedLiveId]);

  const liveEvents: Event[] = liveDetail ? liveEventsToAppEvents(liveDetail) : [];
  const liveState: MatchState | null = liveDetail && liveMode ? liveMatchState(liveDetail, liveEvents) : null;
  const liveActive = Boolean(liveMode && liveState && liveDetail?.status.state === "in");

  const visibleEvents = liveActive ? liveEvents : ALL_EVENTS.slice(0, eventIndex);
  const state: MatchState = liveActive
    ? liveState!
    : computeMatchState(visibleEvents, "Manchester City", "Liverpool");
  const homeStats = liveActive && liveDetail?.stats
    ? {
        possession: liveDetail.stats.home.possession,
        passes: liveDetail.stats.home.accuratePasses,
        passAccuracy: liveDetail.stats.home.totalPasses > 0 ? Math.round((liveDetail.stats.home.accuratePasses / liveDetail.stats.home.totalPasses) * 100) : 0,
        shots: liveDetail.stats.home.shots,
        shotsOnTarget: liveDetail.stats.home.shotsOnTarget,
        tackles: 0,
      }
    : computeTeamStats(visibleEvents, "home");
  const awayStats = liveActive && liveDetail?.stats
    ? {
        possession: liveDetail.stats.away.possession,
        passes: liveDetail.stats.away.accuratePasses,
        passAccuracy: liveDetail.stats.away.totalPasses > 0 ? Math.round((liveDetail.stats.away.accuratePasses / liveDetail.stats.away.totalPasses) * 100) : 0,
        shots: liveDetail.stats.away.shots,
        shotsOnTarget: liveDetail.stats.away.shotsOnTarget,
        tackles: 0,
      }
    : computeTeamStats(visibleEvents, "away");
  const playerStats = liveActive ? [] : computePlayerStats(visibleEvents);
  const insights = generateInsights(visibleEvents, state);
  const keyMoments = detectKeyMoments(visibleEvents);

  const fetchNarrative = useCallback(async () => {
    if (visibleEvents.length === 0) return;
    setLoadingNarrative(true);
    try {
      const res = await fetch("/api/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: visibleEvents.slice(-20), state, mode: prefs.mode, language: prefs.language }),
      });
      const data = await res.json();
      setNarrative(data.narrative || "");
    } catch {
      setNarrative(liveActive ? "Match in progress." : "Match in progress.");
    } finally {
      setLoadingNarrative(false);
    }
  }, [visibleEvents, state, prefs, liveActive]);

  useEffect(() => {
    if (liveActive) {
      const timer = setInterval(() => { void fetchNarrative(); }, 30_000);
      void fetchNarrative();
      return () => clearInterval(timer);
    }
  }, [liveActive, fetchNarrative]);

  useEffect(() => {
    if (!liveActive && playing) {
      intervalRef.current = setInterval(() => {
        setEventIndex((prev) => {
          if (prev >= ALL_EVENTS.length) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 800 / speed);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, speed, liveActive]);

  useEffect(() => {
    if (!liveActive && eventIndex > 0 && eventIndex % 5 === 0) {
      fetchNarrative();
    }
  }, [eventIndex, fetchNarrative, liveActive]);

  const reset = () => {
    setEventIndex(0);
    setPlaying(false);
    setNarrative("");
  };

  const lastEvent = visibleEvents[visibleEvents.length - 1];
  const rawDetail = liveDetail?.status.detail ?? "";
  const statusLabel = liveDetail
    ? liveDetail.status.state === "in"
      ? (liveDetail.clockDisplay || rawDetail || "LIVE").replace(/(\d+'[^·]*)\s·\s\1$/, "$1")
      : rawDetail
    : "";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-900/80 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold">
            ⚽
          </div>
          <h1 className="text-sm font-semibold tracking-tight">Football Match Intelligence</h1>
          {liveActive && (
            <span className="flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/40 px-2 py-0.5 text-[10px] font-bold text-red-400">
              <Radio className="size-3" /> LIVE PREMIER LEAGUE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLiveMode(!liveMode)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition ${liveMode ? "bg-emerald-600 hover:bg-emerald-500" : "bg-slate-700 hover:bg-slate-600"}`}
          >
            {liveMode ? "Live feed: ON" : "Live feed: OFF (demo replay)"}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded hover:bg-slate-700 transition"
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </header>

      {/* Real match picker */}
      {liveMode && (
        <div className="flex items-center justify-center gap-3 py-2 bg-slate-900/70 border-b border-slate-700 flex-wrap px-4">
          <label className="text-xs text-slate-400 flex items-center gap-2">
            <Radio className="size-3.5 text-emerald-400" /> Real Premier League match:
          </label>
          <select
            value={selectedLiveId ?? ""}
            onChange={(e) => setSelectedLiveId(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs max-w-md"
          >
            {liveMatches.length === 0 && <option value="">{liveMatchesError ? "Live feed unavailable" : "Loading fixtures…"}</option>}
            {liveMatches.map((m) => (
              <option key={m.id} value={m.id}>{describeLiveMatch(m)}</option>
            ))}
          </select>
          {liveError && <span className="text-xs text-amber-400">{liveError}</span>}
          {liveDetail && <span className="text-xs text-slate-500">{liveDetail.venue || liveDetail.competition}</span>}
        </div>
      )}

      {/* Scoreboard */}
      <div className="flex items-center justify-center gap-6 py-3 bg-slate-900/50 border-b border-slate-700">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-lg font-bold">
            {liveDetail?.home.crest && <img src={liveDetail.home.crest} alt="" className="h-6 w-6 object-contain" />}
            {state.homeTeam}
          </div>
          <div className="text-3xl font-black text-emerald-400">{state.homeScore}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-400">
            {liveActive ? statusLabel : `MIN ${state.minute}`}
          </div>
          <div className="text-xs text-slate-500">
            {liveActive ? (liveDetail?.period === 2 ? "2nd Half" : "1st Half") : state.half === 1 ? "1st Half" : "2nd Half"}
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-lg font-bold">
            {state.awayTeam}
            {liveDetail?.away.crest && <img src={liveDetail.away.crest} alt="" className="h-6 w-6 object-contain" />}
          </div>
          <div className="text-3xl font-black text-emerald-400">{state.awayScore}</div>
        </div>
      </div>

      {/* Controls (demo replay only; live mode refreshes automatically) */}
      {!liveActive && (
        <div className="flex items-center justify-center gap-3 py-2 bg-slate-800/50">
          <button
            onClick={() => setPlaying(!playing)}
            className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-medium transition"
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button onClick={reset} className="px-4 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-sm transition">
            Reset
          </button>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
          <span className="text-xs text-slate-400">{visibleEvents.length} events · demo replay</span>
        </div>
      )}
      {liveActive && (
        <div className="flex items-center justify-center gap-3 py-2 bg-slate-800/50">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Auto-refreshing every 15s from the live feed</span>
          <button onClick={() => void fetchNarrative()} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs transition">Refresh narrative</button>
          <span className="text-xs text-slate-400">{visibleEvents.length} real events</span>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex flex-wrap gap-4 items-center">
          <div>
            <label className="text-xs text-slate-400 mr-2">Mode:</label>
            <select
              value={prefs.mode}
              onChange={(e) => setPrefs({ ...prefs, mode: e.target.value as any })}
              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
            >
              <option value="analyst">Analyst</option>
              <option value="fan">Fan</option>
              <option value="casual">Casual</option>
              <option value="player_focus">Player Focus</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mr-2">Language:</label>
            <select
              value={prefs.language}
              onChange={(e) => setPrefs({ ...prefs, language: e.target.value })}
              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mr-2">Favorite Team:</label>
            <select
              value={prefs.favoriteTeam || ""}
              onChange={(e) => setPrefs({ ...prefs, favoriteTeam: e.target.value as any || undefined })}
              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
            >
              <option value="">None</option>
              <option value="home">{state.homeTeam}</option>
              <option value="away">{state.awayTeam}</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-hidden">
        {/* Left: Event Feed */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-3 overflow-y-auto max-h-[calc(100vh-280px)]">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Zap className="size-4 text-yellow-400" /> {liveActive ? "Live Events (real)" : "Live Events"}
          </h2>
          <div className="space-y-1">
            {visibleEvents.length === 0 && (
              <div className="text-xs text-slate-500 p-2">
                {liveActive ? "Waiting for the first real match event…" : "Press play to start the match..."}
              </div>
            )}
            {visibleEvents.slice(-30).reverse().map((e) => (
              <div key={e.id} className="text-xs p-2 rounded bg-slate-800/50 border border-slate-700/50">
                <span className="text-slate-400">{Math.floor(e.timestamp / 60)}'</span>{" "}
                <span className={e.team === "home" ? "text-emerald-400" : "text-blue-400"}>{e.player}</span>{" "}
                <span className="text-slate-300">{e.type.replace("_", " ")}</span>
                {e.type === "goal" && <span className="text-yellow-400 ml-1">⚽ GOAL!</span>}
                {e.type === "card" && <span className="ml-1">{e.metadata?.redCard ? "🟥" : "🟨"}</span>}
                {typeof e.metadata?.text === "string" && liveActive && (
                  <div className="text-slate-500 mt-0.5">{e.metadata.text}</div>
                )}
                {e.type === "shot" && !liveActive && <span className="text-slate-500 ml-1">({e.metadata.speed} km/h, xG: {e.metadata.xG})</span>}
              </div>
            ))}
          </div>
          {liveActive && liveDetail && liveDetail.commentary.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-slate-400 mb-2">Play-by-play commentary</h3>
              <div className="space-y-1">
                {liveDetail.commentary.slice(0, 5).map((c, i) => (
                  <div key={i} className="text-xs text-slate-400 p-1.5 rounded bg-slate-800/30">
                    <span className="text-slate-500 mr-1">{c.minute}</span>{c.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Official event video (ESPN clips) */}
          {liveDetail && liveDetail.videos.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                <Radio className="size-3.5 text-red-400" /> Official match video
              </h3>
              <div className="space-y-1">
                {liveDetail.videos.map((v) => (
                  <a key={v.id} href={v.url} target="_blank" rel="noreferrer"
                     className="block text-xs p-2 rounded bg-slate-800/50 border border-slate-700/50 hover:border-emerald-500/50 transition">
                    <span className="text-emerald-400 font-medium">▶ {v.headline}</span>
                    <span className="text-slate-500 ml-1">
                      {v.duration > 0 ? `${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, "0")}` : "clip"}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center: Insights & Narrative */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-3 overflow-y-auto max-h-[calc(100vh-280px)]">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <MessageSquare className="size-4 text-purple-400" /> Match Narrative
          </h2>
          {loadingNarrative ? (
            <div className="text-sm text-slate-400 animate-pulse">Generating narrative...</div>
          ) : (
            <div className="text-sm text-slate-200 leading-relaxed mb-4">{narrative || (liveActive ? "Awaiting the first narrative from the live feed…" : "Press play to start the match...")}</div>
          )}

          <h2 className="text-sm font-semibold mb-2 mt-4 flex items-center gap-2">
            <Eye className="size-4 text-cyan-400" /> Key Insights
          </h2>
          <div className="space-y-2">
            {insights.slice(0, 8).map((ins) => (
              <div key={ins.id} className="p-2 rounded bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold ${
                    ins.importance === "critical" ? "text-red-400" :
                    ins.importance === "high" ? "text-yellow-400" :
                    ins.importance === "medium" ? "text-blue-400" : "text-slate-400"
                  }`}>{ins.title}</span>
                  <span className="text-xs text-slate-500">{Math.floor(ins.timestamp / 60)}'</span>
                </div>
                <div className="text-xs text-slate-300">{ins.description}</div>
                {prefs.mode === "analyst" && (
                  <div className="text-xs text-slate-500 mt-1 italic">{ins.explanation}</div>
                )}
              </div>
            ))}
          </div>

          {/* Explainability for last event */}
          {lastEvent && (
            <div className="mt-4 p-2 rounded bg-indigo-900/30 border border-indigo-700/50">
              <div className="text-xs font-semibold text-indigo-300 mb-1">Why this moment matters:</div>
              <div className="text-xs text-slate-300">{explainMoment(lastEvent, state)}</div>
            </div>
          )}
        </div>

        {/* Right: Stats */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-3 overflow-y-auto max-h-[calc(100vh-280px)]">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <BarChart3 className="size-4 text-orange-400" /> Match Stats
          </h2>
          {liveActive && liveDetail?.stats && (
            <div className="text-[10px] text-slate-500 mb-2">Source: live provider statistics ({liveDetail.competition})</div>
          )}

          {/* Team comparison */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span>{state.homeTeam}</span>
              <span>{state.awayTeam}</span>
            </div>
            {[
              { label: "Possession", home: homeStats.possession, away: awayStats.possession, suffix: "%" },
              { label: "Passes", home: homeStats.passes, away: awayStats.passes },
              { label: "Pass Acc", home: homeStats.passAccuracy, away: awayStats.passAccuracy, suffix: "%" },
              { label: "Shots", home: homeStats.shots, away: awayStats.shots },
              { label: "On Target", home: homeStats.shotsOnTarget, away: awayStats.shotsOnTarget },
              ...(liveActive ? [] : [{ label: "Tackles", home: homeStats.tackles, away: awayStats.tackles }]),
            ].map((s) => (
              <div key={s.label} className="mb-2">
                <div className="flex justify-between text-xs text-slate-400 mb-0.5">
                  <span>{s.home}{s.suffix || ""}</span>
                  <span>{s.label}</span>
                  <span>{s.away}{s.suffix || ""}</span>
                </div>
                <div className="flex h-1.5 rounded overflow-hidden bg-slate-700">
                  <div className="bg-emerald-500" style={{ width: `${(s.home / (s.home + s.away || 1)) * 100}%` }} />
                  <div className="bg-blue-500" style={{ width: `${(s.away / (s.home + s.away || 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Top players (demo replay only — player-level live data is not in the free feed) */}
          {!liveActive && (
            <>
              <h3 className="text-xs font-semibold text-slate-400 mb-2">Top Players</h3>
              <div className="space-y-1">
                {playerStats.slice(0, 6).map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-800/50">
                    <span className={p.team === "home" ? "text-emerald-400" : "text-blue-400"}>{p.name}</span>
                    <span className="text-slate-400">{p.passes}p {p.passAccuracy}% {p.shots}s</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {liveActive && (
            <div className="text-xs text-slate-500 p-2 rounded bg-slate-800/30">
              Player-level telemetry is not part of the free live feed. Team statistics above are real.
            </div>
          )}

          {/* Key moments count */}
          <div className="mt-4 text-xs text-slate-400">
            {keyMoments.length} key moments detected
          </div>
        </div>
      </div>
    </div>
  );
}
