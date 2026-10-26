import { useCallback, useEffect, useRef, useState } from "react";
import type { MatchEvent, Snapshot } from "./data";

export type LiveTeam = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  crest: string;
  color: string;
  score: number;
};

export type LiveStats = {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  accuratePasses: number;
  totalPasses: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  corners: number;
  offsides: number;
  saves: number;
};

export type LiveMatchListItem = {
  id: string;
  competition: string;
  utcDate: string;
  venue: string;
  status: { state: "pre" | "in" | "post"; detail: string; completed: boolean };
  home: LiveTeam;
  away: LiveTeam;
};

export type LiveMatchInfo = {
  id: string;
  competition: string;
  utcDate: string;
  venue: string;
  status: { state: "pre" | "in" | "post"; detail: string; completed: boolean };
  clockDisplay: string;
  period: number;
  home: LiveTeam;
  away: LiveTeam;
  stats: { home: LiveStats; away: LiveStats } | null;
  statsSource: "provider" | "derived" | "unavailable";
  videos?: { id: string; headline: string; description: string; duration: number; url: string }[];
};

export type LiveFeedPayload = {
  mode: "live";
  provider: "espn" | "footballdata";
  match?: LiveMatchInfo;
  pending?: boolean;
  error?: string | null;
  cursor?: number;
  event?: MatchEvent | null;
  events?: MatchEvent[];
  snapshot?: Snapshot;
  commentary?: { minute: string; text: string }[];
  updatedAt?: string;
};

export type LiveFeedState = {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  connected: boolean;
  provider: string | null;
  providerError: string | null;
  matches: LiveMatchListItem[];
  payload: LiveFeedPayload | null;
  selectedMatchId: string | null;
  selectMatch: (matchId: string) => void;
};

export function useLiveFeed(): LiveFeedState {
  // Synthetic-first (hackathon requirement): the football-realistic demo
  // engine is the primary data source. The optional public-feed connector
  // starts disabled and can be toggled from the control strip.
  const [enabled, setEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [matches, setMatches] = useState<LiveMatchListItem[]>([]);
  const [payload, setPayload] = useState<LiveFeedPayload | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const enabledRef = useRef(enabled);
  const selectedRef = useRef(selectedMatchId);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { selectedRef.current = selectedMatchId; }, [selectedMatchId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/live/matches");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        setMatches(data.matches ?? []);
        setProvider(data.provider ?? null);
        setProviderError(data.error ?? null);
        setSelectedMatchId((current) => current ?? data.selectedMatchId ?? null);
      } catch (error) {
        if (!cancelled) setProviderError(error instanceof Error ? error.message : "Live provider unreachable");
      }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      setPayload(null);
      return;
    }
    let cancelled = false;
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/live/stream");
      es.onopen = () => { if (!cancelled) setConnected(true); };
      es.onmessage = (message) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(message.data) as LiveFeedPayload;
          setPayload(data);
          if (data.match?.id) setSelectedMatchId(data.match.id);
        } catch { /* ignore malformed frames */ }
      };
      es.onerror = () => {
        if (!cancelled) setConnected(false);
      };
    } catch {
      setConnected(false);
    }
    return () => { cancelled = true; es?.close(); };
  }, [enabled]);

  // Safety net: if the SSE connection stalls (e.g. the tab was backgrounded
  // and the browser throttled the reconnect), refresh via REST and adopt any
  // payload newer than what the stream last delivered.
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/live/state");
        if (!response.ok) return;
        const data = (await response.json()) as { payload?: LiveFeedPayload | null };
        const fresh = data.payload;
        if (!fresh?.match) return;
        setPayload((current) => {
          if (!current?.match || !current.updatedAt || current.updatedAt !== fresh.updatedAt) {
            return fresh;
          }
          return current;
        });
        if (fresh.match.id) setSelectedMatchId((id) => id ?? fresh.match!.id);
      } catch {
        /* REST refresh is best-effort; the SSE stream remains primary */
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  const selectMatch = useCallback((matchId: string) => {
    setSelectedMatchId(matchId);
    void fetch("/api/live/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId }),
    }).catch(() => undefined);
  }, []);

  return { enabled, setEnabled, connected, provider, providerError, matches, payload, selectedMatchId, selectMatch };
}

export function describeLiveMatch(match: LiveMatchListItem): string {
  const status = match.status.state === "in" ? "LIVE" : match.status.state === "post" ? "FT" : new Date(match.utcDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${match.home.shortName} ${match.home.score}–${match.away.score} ${match.away.shortName} · ${status}`;
}
