import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import {
  Activity, ArrowUpRight, BellRing, Check, ChevronRight, CircleHelp, Clipboard,
  FileText, Gauge, Globe2, LayoutDashboard, MessageCircle, Pause, Play,
  Radio, RotateCcw, Search, Settings2, Sparkles, Target, UserRound, Zap, Scale, Copy,
} from "lucide-react";
import {
  getInsightForState, getSnapshot, initialEvents, nextEvent, players, replayScenarios,
  type Insight, type Language, type MatchEvent, type ReplayScenario, type Snapshot, type TacticalState,
} from "./data";
import { evaluateDecisionOptions, formatDecisionRecommendation, type DecisionAction, type DecisionHorizon } from "./decision";
import { describeLiveMatch, useLiveFeed, type LiveMatchInfo, type LiveMatchListItem } from "./live";
import { AskView } from "./ask-view";
import { SettingsDrawer } from "./settings-drawer";
import { t, translateEventLabel, translateStatus, LANGUAGES } from "./i18n";

type View = "live" | "ask" | "decision" | "insights" | "recaps" | "performance";

const navItems: { id: View; label: string; short: string; icon: typeof LayoutDashboard }[] = [
  { id: "live", label: "Live studio", short: "LIVE", icon: Radio },
  { id: "ask", label: "Ask MatchMind", short: "ASK", icon: MessageCircle },
  { id: "decision", label: "Decision lab", short: "CHOICES", icon: Scale },
  { id: "insights", label: "Insight library", short: "STORIES", icon: Sparkles },
  { id: "recaps", label: "Match recaps", short: "RECAPS", icon: FileText },
  { id: "performance", label: "Performance lab", short: "METRICS", icon: Gauge },
];
function formatClock(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
function localizedNarrative(insight: Insight, language: Language) { if (language === "ES") return insight.spanish; if (language === "FR") return insight.french; if (language === "HI") return insight.hindi; return insight.analyst; }
function LanguageSelect({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) {
  return <select value={language} onChange={(event) => onLanguageChange(event.target.value as Language)} aria-label="Output language">{LANGUAGES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>;
}

function App() {
  const [view, setView] = useState<View>("live");
  const [isPlaying, setIsPlaying] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [events, setEvents] = useState<MatchEvent[]>(initialEvents);
  const [streamConnected, setStreamConnected] = useState(false);
  const [language, setLanguage] = useState<Language>("EN");
  const [favoritePlayer, setFavoritePlayer] = useState("player-07");
  const [scenario, setScenario] = useState<ReplayScenario>("pressure-pulse");
  const [selectedEvent, setSelectedEvent] = useState<MatchEvent | null>(initialEvents[0]);
  const [activeEvidence, setActiveEvidence] = useState<string | null>(null);
  const [selectedInsightState, setSelectedInsightState] = useState<TacticalState>("PRESSURE");
  const [copied, setCopied] = useState(false);
  const [decisionAction, setDecisionAction] = useState<DecisionAction>("press-higher");
  const [decisionHorizon, setDecisionHorizon] = useState<DecisionHorizon>(5);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const live = useLiveFeed();
  const liveMatch = live.payload?.match ?? null;
  const liveActive = Boolean(liveMatch) && live.connected;
  const hasLiveMatch = live.matches.some((item) => item.status.state === "in");
  const syntheticSnapshot = useMemo(() => getSnapshot(cursor, scenario), [cursor, scenario]);
  const snapshot: Snapshot = liveActive && live.payload?.snapshot ? live.payload.snapshot : syntheticSnapshot;
  const activeEvents = liveActive && live.payload?.events ? live.payload.events : events;
  const activeSelectedEvent = liveActive && live.payload ? (live.payload.event ?? null) : selectedEvent;
  const liveContextLabel = liveMatch ? `${liveMatch.home.shortName} vs ${liveMatch.away.shortName}` : null;
  const playingRef = useRef(isPlaying);
  const fallbackCursorRef = useRef(0);
  const liveActiveRef = useRef(false);
  useEffect(() => { liveActiveRef.current = liveActive; }, [liveActive]);
  const insightArchive = useMemo(() => (["PRESSURE", "SWING", "CONTROL", "CHAOS"] as TacticalState[]).map((state, index) => ({ ...getInsightForState(state), timestamp: ["18:42", "17:58", "16:31", "14:09"][index], impact: ["High", "High", "Medium", "Medium"][index] })), []);

  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { let cancelled = false; fetch("/api/health").then((response) => { if (response.ok && !cancelled) setStreamConnected(true); }).catch(() => { if (!cancelled) setStreamConnected(false); }); return () => { cancelled = true; }; }, []);
  useEffect(() => {
    let localTimer: number | null = null;
    let es: EventSource | null = null;
    let cancelled = false;

    const startLocal = () => {
      if (localTimer !== null) return;
      localTimer = window.setInterval(() => {
        if (!playingRef.current || liveActiveRef.current) return;
        fallbackCursorRef.current += 1;
        const nextCursor = fallbackCursorRef.current;
        const event = nextEvent(nextCursor, getSnapshot(nextCursor, scenario).clock, scenario);
        setCursor(nextCursor); setEvents((current) => [...current, event].slice(-9)); setSelectedEvent(event);
      }, 1800);
    };
    const stopLocal = () => {
      if (localTimer !== null) { window.clearInterval(localTimer); localTimer = null; }
    };

    try {
      es = new EventSource("/api/matches/match-001/events/stream");
      es.onopen = () => {
        if (cancelled) return;
        setStreamConnected(true);
        stopLocal();
      };
      es.onmessage = (message) => {
        if (cancelled || !playingRef.current || liveActiveRef.current) return;
        try {
          const payload = JSON.parse(message.data);
          setCursor(payload.cursor);
          setEvents(payload.events);
          setSelectedEvent(payload.event);
          fallbackCursorRef.current = payload.cursor;
        } catch {
          // Ignore malformed payloads and keep the local fallback.
        }
      };
      es.onerror = () => {
        if (cancelled) return;
        setStreamConnected(false);
        es?.close();
        es = null;
        startLocal();
      };
    } catch {
      setStreamConnected(false);
      startLocal();
    }

    startLocal();
    return () => {
      cancelled = true;
      stopLocal();
      es?.close();
    };
  }, [scenario]);

  function resetReplay() {
    setCursor(0); fallbackCursorRef.current = 0; setEvents(initialEvents); setSelectedEvent(initialEvents[0]); setActiveEvidence(null); setIsPlaying(true);
    fetch(`/api/replay/reset?scenario=${encodeURIComponent(scenario)}`, { method: "POST" }).catch(() => undefined);
  }
  function changeScenario(nextScenario: ReplayScenario) {
    setScenario(nextScenario);
    setCursor(0); fallbackCursorRef.current = 0; setEvents(initialEvents); setSelectedEvent(initialEvents[0]); setActiveEvidence(null); setIsPlaying(true);
    fetch(`/api/replay/reset?scenario=${encodeURIComponent(nextScenario)}`, { method: "POST" }).catch(() => undefined);
  }
  function selectEvidence(label: string) { setActiveEvidence(label); setView("live"); }
  async function copyRecap() {
    const recap = `${snapshot.insight.title}. ${localizedNarrative(snapshot.insight, language)}`;
    try { await navigator.clipboard.writeText(recap); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><div className="brand-mark"><Sparkles size={16} /></div><div className="brand-copy"><div className="brand-name">MATCHMIND <span>AI</span></div><div className="brand-subtitle">Match intelligence platform</div></div></div>
      <div className="workspace-switcher"><span className="workspace-avatar">PL</span><span><small>WORKSPACE</small><strong>Premier League Studio</strong></span><ChevronRight size={14} /></div>
      <div className="sidebar-label">CONTROL ROOM</div>
      <nav className="sidebar-nav" aria-label="Product navigation">{navItems.map((item) => <button key={item.id} data-testid={`nav-${item.id}`} aria-current={view === item.id ? "page" : undefined} className={`sidebar-item ${view === item.id ? "active" : ""}`} onClick={() => setView(item.id)}><item.icon size={16} /><span>{item.label}</span><small>{item.short}</small>{view === item.id && <i />}</button>)}</nav>
      <div className="sidebar-divider" /><div className="sidebar-label">MATCH</div>
      {liveMatch ? (
        <div className="sidebar-match"><div className="mini-crest mint-crest">{liveMatch.home.crest ? <img src={liveMatch.home.crest} alt="" /> : liveMatch.home.abbreviation.slice(0, 1)}</div><div><strong>{liveMatch.home.shortName} vs {liveMatch.away.shortName}</strong><span>{liveMatch.home.score} — {liveMatch.away.score} · {liveMatch.clockDisplay || liveMatch.status.detail}</span></div>{liveMatch.status.state === "in" && <span className="mini-live" />}</div>
      ) : (
        <div className="sidebar-match"><div className="mini-crest mint-crest">N</div><div><strong>Northbridge FC</strong><span>1 — 0 · {formatClock(snapshot.clock)}</span></div><span className="mini-live" /></div>
      )}
      <div className="sidebar-bottom"><div className="pipeline-status"><span className="status-pulse" /><div><strong>{liveActive ? "Public feed connector" : "Synthetic replay active"}</strong><span>{liveActive ? `Real events via ${live.provider ?? "espn"}` : "Football-realistic synthetic engine"}</span></div></div><button className="sidebar-settings" onClick={() => setSettingsOpen(true)}><Settings2 size={15} /><span>{t(language, "settings")}</span></button></div>
    </aside>
    <div className="app-frame">
      <header className="app-topbar"><div className="topbar-context"><span className="context-dot" />{t(language, "matchCentre")} <ChevronRight size={13} /><span>{view === "live" ? "Studio view" : navItems.find((item) => item.id === view)?.label}</span></div><div className="topbar-actions"><div className="topbar-stream"><span className="status-pulse" />{streamConnected ? t(language, "streamConnected") : t(language, "streamOffline")}</div><button className="topbar-icon" title="Notifications"><BellRing size={16} /></button><button className="topbar-icon" title="Help"><CircleHelp size={16} /></button><span className="topbar-divider" /><button className="profile-button">NM<span /></button></div></header>
      <main className="workspace">
        {view === "live" && <LiveView snapshot={snapshot} events={activeEvents} selectedEvent={activeSelectedEvent} activeEvidence={activeEvidence} language={language} favoritePlayer={favoritePlayer} scenario={scenario} isPlaying={isPlaying} match={liveMatch} hasLiveMatch={hasLiveMatch} liveMatches={live.matches} selectedLiveId={live.selectedMatchId} liveConnected={live.connected} liveEnabled={live.enabled} liveProvider={live.provider} liveError={live.providerError} onSelectLiveMatch={live.selectMatch} onToggleLive={live.setEnabled} onOpenSettings={() => setSettingsOpen(true)} onLanguageChange={setLanguage} onFavoriteChange={setFavoritePlayer} onScenarioChange={changeScenario} onSelectEvent={setSelectedEvent} onSelectEvidence={setActiveEvidence} onTogglePlaying={() => setIsPlaying((value) => !value)} onReset={resetReplay} onOpenRecaps={() => setView("recaps")} onOpenInsights={() => setView("insights")} />}
        {view === "decision" && <DecisionLab snapshot={snapshot} events={activeEvents} scenario={scenario} liveLabel={liveContextLabel} action={decisionAction} horizon={decisionHorizon} onAction={setDecisionAction} onHorizon={setDecisionHorizon} onCopy={async (text) => { try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); } }} copied={copied} />}
        {view === "insights" && <InsightsView insights={insightArchive} selectedState={selectedInsightState} activeEvidence={activeEvidence} onSelectState={setSelectedInsightState} onSelectEvidence={selectEvidence} onOpenLive={() => setView("live")} />}
        {view === "recaps" && <RecapsView snapshot={snapshot} events={activeEvents} language={language} copied={copied} match={liveMatch} hasLiveMatch={hasLiveMatch} liveMatches={live.matches} selectedLiveId={live.selectedMatchId} onSelectLiveMatch={live.selectMatch} onLanguageChange={setLanguage} onCopy={copyRecap} />}
        {view === "ask" && <AskView match={liveMatch} language={language} />}
        {view === "performance" && <PerformanceView snapshot={snapshot} events={activeEvents} match={liveMatch} language={language} onLanguageChange={setLanguage} onOpenLive={() => setView("live")} />}
      </main>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} language={language} onLanguageChange={setLanguage} liveEnabled={live.enabled} onLiveEnabledChange={live.setEnabled} liveConnected={live.connected} provider={live.provider} match={liveMatch} />
    </div>
  </div>;
}

function LiveView({ snapshot, events, selectedEvent, activeEvidence, language, favoritePlayer, scenario, isPlaying, match, hasLiveMatch, liveMatches, selectedLiveId, liveConnected, liveEnabled, liveProvider, liveError, onSelectLiveMatch, onToggleLive, onOpenSettings, onLanguageChange, onFavoriteChange, onScenarioChange, onSelectEvent, onSelectEvidence, onTogglePlaying, onReset, onOpenRecaps, onOpenInsights }: { snapshot: Snapshot; events: MatchEvent[]; selectedEvent: MatchEvent | null; activeEvidence: string | null; language: Language; favoritePlayer: string; scenario: ReplayScenario; isPlaying: boolean; match: LiveMatchInfo | null; hasLiveMatch: boolean; liveMatches: LiveMatchListItem[]; selectedLiveId: string | null; liveConnected: boolean; liveEnabled: boolean; liveProvider: string | null; liveError: string | null; onSelectLiveMatch: (id: string) => void; onToggleLive: (value: boolean) => void; onOpenSettings: () => void; onLanguageChange: (language: Language) => void; onFavoriteChange: (player: string) => void; onScenarioChange: (scenario: ReplayScenario) => void; onSelectEvent: (event: MatchEvent) => void; onSelectEvidence: (evidence: string) => void; onTogglePlaying: () => void; onReset: () => void; onOpenRecaps: () => void; onOpenInsights: () => void }) {
  const homeName = match?.home.shortName ?? "Northbridge FC";
  const awayName = match?.away.shortName ?? "Riverside United";
  const stats = match?.stats ?? null;
  const [graphicsCopied, setGraphicsCopied] = useState(false);
  async function copyGraphicsPayload() {
    const payload = {
      contract: "matchmind-graphics/v1",
      matchId: match?.id ?? "match-001",
      competition: match?.competition ?? "Premier League",
      clock: match?.clockDisplay ?? formatClock(snapshot.clock),
      status: match?.status.detail ?? "synthetic",
      score: match ? `${match.home.name} ${match.home.score} - ${match.away.score} ${match.away.name}` : null,
      tacticalState: snapshot.state,
      headline: snapshot.insight.title,
      evidence: snapshot.insight.evidence,
      possession: snapshot.possession,
      source: match ? "live premier league feed" : "synthetic local preview",
      generatedAt: new Date().toISOString(),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setGraphicsCopied(true);
      window.setTimeout(() => setGraphicsCopied(false), 1800);
    } catch { /* clipboard unavailable in embedded previews */ }
  }
  return <div className="page live-page"><PageHeader eyebrow="LIVE STUDIO" title="Match intelligence in motion" description="Real Premier League events, turned into stories your studio can use." actions={<><button className="secondary-button" onClick={onOpenInsights}><Sparkles size={15} /> Browse insights</button><button className="primary-button" onClick={onOpenRecaps}><FileText size={15} /> Build recap</button></>} />
    {match && !hasLiveMatch && <div className="nolive-banner" data-testid="no-live-banner"><Radio size={14} /><span>{t(language, "noLive")}</span></div>}
    {!match && liveMatches.length === 0 && <div className="nolive-banner" data-testid="no-fixtures-banner"><Radio size={14} /><span>{liveError ? liveError : t(language, "noFixtures")}</span></div>}
    <section className="match-hero panel"><div className="match-hero-top"><span className="live-tag"><span className="live-dot" />{t(language, "live")} · {match ? t(language, "realFeed") : t(language, "syntheticStream")}</span><span className="match-id">{match ? `${match.competition.toUpperCase()}${match.venue ? ` · ${match.venue}` : ""}` : "MATCH-001 / ROUND 08"}</span></div><div className="match-hero-main"><TeamBlock crest={match?.home.abbreviation.slice(0, 1) ?? "N"} crestUrl={match?.home.crest} name={homeName} label={t(language, "home")} tone="mint" /><div className="hero-score"><div className="score">{match ? match.home.score : 1} <span>—</span> {match ? match.away.score : 0}</div><div className="hero-clock"><ClockIcon />{match ? (match.clockDisplay || match.status.detail) : formatClock(snapshot.clock)} <span>{match ? translateStatus(language, match.status.state) : "of 90:00"}</span></div></div><TeamBlock crest={match?.away.abbreviation.slice(0, 1) ?? "R"} crestUrl={match?.away.crest} name={awayName} label={t(language, "away")} tone="coral" align="right" /></div><div className="match-hero-bottom"><div className="hero-info"><span>{match ? t(language, "venue") : "WEATHER"}</span><strong>{match ? (match.venue || "Premier League") : "Clear · 14°C"}</strong></div><div className="hero-info"><span>{t(language, "dataSource")}</span><strong>{match ? `${(liveProvider ?? "espn").toUpperCase()} · live` : "Local simulator"}</strong></div><div className="hero-momentum"><span>{homeName} momentum</span><div className="hero-bars">{[22, 32, 42, 39, 55, 61, 56, 79, 88, 92].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div><strong>+18</strong></div></div></section>
    <div className="control-strip"><div className="replay-control"><Radio size={14} /><span>{t(language, "premierLeague")}</span><select value={selectedLiveId ?? ""} onChange={(event) => onSelectLiveMatch(event.target.value)} aria-label="Live Premier League match">{liveMatches.length === 0 && <option value="">{liveError ? "Live feed unavailable" : "Loading fixtures…"}</option>}{liveMatches.map((item) => <option key={item.id} value={item.id}>{describeLiveMatch(item)}</option>)}</select></div>{!match && <div className="replay-control"><RotateCcw size={14} /><span>{t(language, "replay")}</span><select value={scenario} onChange={(event) => onScenarioChange(event.target.value as ReplayScenario)}>{replayScenarios.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>}<div className="control-strip-right"><span className="engine-badge"><span /> {match ? `${t(language, "liveData")} · ${(liveProvider ?? "espn").toUpperCase()}${liveConnected ? "" : ` · ${t(language, "reconnecting")}`}` : t(language, "syntheticEngine")}</span><button className={`secondary-button compact ${liveEnabled ? "" : "selected"}`} onClick={() => onToggleLive(!liveEnabled)} title="Toggle between the real Premier League feed and the synthetic demo replay">{liveEnabled ? t(language, "liveFeedOn") : t(language, "demoReplay")}</button>{!match && <button data-testid="button-toggle-replay" className="secondary-button compact" onClick={onTogglePlaying}>{isPlaying ? <Pause size={14} /> : <Play size={14} />}{isPlaying ? "Pause" : "Resume"}</button>}{!match && <button className="icon-button" data-testid="button-reset-replay" onClick={onReset} title="Reset replay" aria-label="Reset replay"><RotateCcw size={15} /></button>}<button className="secondary-button compact" onClick={copyGraphicsPayload} title="Copy machine-readable graphics JSON for playout systems (Vizrt / Chyron / OBS) or second-screen apps"><Clipboard size={14} />{graphicsCopied ? "Copied JSON" : "Copy graphics JSON"}</button><button className="secondary-button compact" onClick={onOpenSettings} title={t(language, "settings")}><Settings2 size={14} />{t(language, "settings")}</button></div></div>
    <div className="metric-grid"><Metric label={t(language, "possession")} value={`${snapshot.possession[0]}%`} secondary={`${snapshot.possession[1]}% ${awayName}`} trend={match ? (stats ? t(language, "provider") : t(language, "derived")) : "+4.2%"} accent="mint" /><Metric label={t(language, "passCompletion")} value={`${snapshot.passCompletion[0]}%`} secondary={`${snapshot.passCompletion[1]}% ${awayName}`} trend={match ? (stats ? t(language, "provider") : t(language, "derived")) : "+8.0%"} accent="blue" /><Metric label={t(language, "pressureIndex")} value={`${snapshot.pressure}`} secondary={`${homeName} live score`} trend={match ? t(language, "derived") : "+18"} accent="coral" /><Metric label={t(language, "matchTempo")} value={`${snapshot.tempo}`} secondary={match ? "derived from real events" : "vs 50 match average"} trend={match ? t(language, "derived") : "+12%"} accent="yellow" /></div>{stats ? <div className="live-performance-strip"><span><b>{stats.home.shots + stats.away.shots}</b> {t(language, "totalShots")}</span><span><b>{stats.home.shotsOnTarget + stats.away.shotsOnTarget}</b> {t(language, "onTarget")}</span><span><b>{stats.home.corners + stats.away.corners}</b> {t(language, "corners")}</span><span><b>{stats.home.fouls + stats.away.fouls}</b> {t(language, "fouls")}</span><span><b>{stats.home.possession}% / {stats.away.possession}%</b> {t(language, "possessionSplit")}</span></div> : <div className="live-performance-strip"><span><b>{snapshot.ballSpeedKph} km/h</b> {t(language, "ballSpeed")}</span><span><b>{snapshot.shotSpeedKph} km/h</b> {t(language, "shotSpeed")}</span><span><b>{snapshot.passQuality}/100</b> {t(language, "passQuality")}</span><span><b>{snapshot.autoEventConfidence}%</b> {t(language, "eventSignal")}</span></div>}
    <section className="live-grid"><EventFeed events={events} selectedEvent={selectedEvent} activeEvidence={activeEvidence} live={Boolean(match)} language={language} onSelect={onSelectEvent} /><InsightCard insight={snapshot.insight} language={language} activeEvidence={activeEvidence} onEvidence={onSelectEvidence} /></section>
    <section className="bottom-grid"><PlayerFocus favoritePlayer={favoritePlayer} /><PipelineCard language={language} onLanguageChange={onLanguageChange} /></section>
  </div>;
}

function DecisionLab({ snapshot, events, scenario, liveLabel, action, horizon, onAction, onHorizon, onCopy, copied }: { snapshot: Snapshot; events: MatchEvent[]; scenario: ReplayScenario; liveLabel: string | null; action: DecisionAction; horizon: DecisionHorizon; onAction: (action: DecisionAction) => void; onHorizon: (horizon: DecisionHorizon) => void; onCopy: (text: string) => void; copied: boolean }) {
  const options = useMemo(() => evaluateDecisionOptions(snapshot, events, horizon), [snapshot, events, horizon]);
  const selected = options.find((option) => option.action === action) ?? options[0];
  const recommendation = formatDecisionRecommendation(selected, horizon);
  const labels: Record<DecisionAction, string> = { "press-higher": "Press higher", "hold-shape": "Hold shape", "attack-wide": "Attack wide" };
  return <div className="page decision-page">
    <PageHeader eyebrow="DECISION LAB / LOCAL REPLAY" title="Compare the next coaching move" description="Read the current match, then test three tactical choices against the same recent evidence." actions={<span className="decision-run-badge"><span /> {liveLabel ? "LIVE CONTEXT · RULES-BASED SIGNALS" : "DETERMINISTIC · LOCAL ONLY"}</span>} />
    <section className="decision-context panel" data-testid="decision-context">
      <div className="decision-context-main"><span className="eyebrow">CURRENT MATCH CONTEXT</span><strong>{liveLabel ?? scenario.replaceAll("-", " ")} <i>·</i> {formatClock(snapshot.clock)} <i>·</i> {snapshot.state}</strong><p>{snapshot.insight.title}</p></div>
      <div className="decision-context-stats"><span><small>Pressure index</small><b>{snapshot.pressure}/100</b></span><span><small>Territory</small><b>{snapshot.territory}%</b></span><span><small>Possession</small><b>{snapshot.possession[0]}%</b></span></div>
    </section>
    <div className="decision-toolbar">
      <div><span className="eyebrow">COMPARE ACTIONS</span><p>Each score is a rules-based alignment signal, not a probability, forecast, or measured outcome.</p></div>
      <label className="horizon-control">Illustrative horizon <select data-testid="select-decision-horizon" aria-label="Illustrative time horizon" value={horizon} onChange={(event) => onHorizon(Number(event.target.value) as DecisionHorizon)}><option value={3}>3 minutes</option><option value={5}>5 minutes</option><option value={10}>10 minutes</option></select></label>
    </div>
    <section className="decision-options" aria-label="Coaching action comparisons" data-testid="decision-options">
      {options.map((option) => <button type="button" key={option.action} data-testid={`decision-option-${option.action}`} aria-pressed={action === option.action} className={`decision-option panel ${action === option.action ? "selected" : ""}`} onClick={() => onAction(option.action)}>
        <span className="decision-option-top"><span className="decision-index">0{options.indexOf(option) + 1}</span><span className="decision-option-label">{labels[option.action]}</span><span className="decision-select-state">{action === option.action ? "SELECTED" : "COMPARE"}</span></span>
        <span className="decision-fit-label">Rules-based alignment signal <b>{option.fitScore}<small>/100</small></b></span>
        <span className="decision-score-track"><i style={{ width: `${option.fitScore}%` }} /></span>
        <span className="decision-metrics"><span>Territory signal <b>{option.territorySignal}</b></span><span>Regain signal <b>{option.regainSignal}</b></span><span>Exposure risk <b>{option.exposureRisk}</b></span><span>Workload <b>{option.workload}</b></span></span>
        <span className="decision-option-summary">{option.summary}</span>
      </button>)}
    </section>
    <div className="decision-detail-grid">
      <section className="decision-detail panel" data-testid="decision-selected-detail">
        <div className="section-heading"><div><span className="eyebrow">SELECTED ACTION · {horizon} MINUTE HORIZON</span><h2>{selected.label}</h2></div><span className="illustrative-tag">ILLUSTRATIVE ONLY</span></div>
        <div className="decision-detail-copy"><p>{selected.summary}</p><div className="decision-pros-risks"><div><span className="decision-kicker">WHY IT FITS THIS MATCH</span><p>{selected.tradeoff}</p></div><div><span className="decision-kicker">ASSUMPTIONS</span><p>Rules use the current snapshot and up to 9 recent events. Signals are deterministic and describe alignment with observed inputs only.</p></div></div></div>
        <div className="decision-evidence"><div className="decision-evidence-head"><span className="eyebrow">SUPPORTING SOURCE EVENTS</span><span>{selected.evidence.length} linked IDs</span></div>{selected.evidence.length ? <div className="decision-evidence-list">{selected.evidence.map((event) => <div className="decision-evidence-item" key={event.id} data-testid={`decision-evidence-${event.id}`}><code>{event.id}</code><span><b>{event.label}</b><small>{event.minute}:{String(event.second).padStart(2, "0")} · {event.zone.replaceAll("-", " ")} · {event.outcome}</small></span></div>)}</div> : <p className="decision-no-evidence">No matching events in the current recent window.</p>}</div>
        <div className="decision-actions"><button className="secondary-button" data-testid="button-copy-recommendation" onClick={() => onCopy(recommendation)}><Copy size={14} />{copied ? "Copied recommendation" : "Copy recommendation"}</button></div>
      </section>
      <aside className="decision-side panel"><span className="eyebrow">DECISION NOTE</span><div className="decision-note-mark"><Scale size={18} /></div><h3>Signal, not certainty.</h3><p>This lab compares tactical choices from the match state and event window in view. It does not estimate match outcomes or issue coaching instructions.</p><div className="decision-side-rule" /><span className="decision-kicker">INPUT WINDOW</span><strong>Up to 9 recent events</strong><small>Current source window may be shorter. Event IDs remain tied to this match.</small><div className="decision-side-rule" /><span className="decision-kicker">CURRENT ACTION</span><strong>{selected.label}</strong><small>{horizon}-minute illustrative comparison</small></aside>
    </div>
  </div>;
}

function InsightsView({ insights, selectedState, activeEvidence, onSelectState, onSelectEvidence, onOpenLive }: { insights: (Insight & { timestamp: string; impact: string })[]; selectedState: TacticalState; activeEvidence: string | null; onSelectState: (state: TacticalState) => void; onSelectEvidence: (evidence: string) => void; onOpenLive: () => void }) {
  const selected = insights.find((insight) => insight.state === selectedState) ?? insights[0];
  return <div className="page"><PageHeader eyebrow="INSIGHT LIBRARY" title="Stories with a proof trail" description="Every narrative is tied back to the events and metrics that caused it." actions={<button className="primary-button" onClick={onOpenLive}><Radio size={15} /> Return to live</button>} /><div className="overview-grid"><OverviewStat icon={<Sparkles size={16} />} label="Stories generated" value="12" note="3 high-impact" /><OverviewStat icon={<Target size={16} />} label="Evidence links" value="37" note="100% traceable" /><OverviewStat icon={<Gauge size={16} />} label="Avg. latency" value="420ms" note="Live target < 2s" /><OverviewStat icon={<Globe2 size={16} />} label="Languages" value="04" note="EN · ES · FR · HI" /></div><div className="insights-layout"><section className="story-list panel"><div className="section-heading"><div><span className="eyebrow">LIVE ARCHIVE</span><h2>Generated stories</h2></div><button className="filter-button"><Search size={14} /> Search</button></div><div className="story-filters"><button className="active">All stories <span>12</span></button><button>High impact <span>3</span></button><button>Player focus <span>4</span></button></div>{insights.map((insight) => <button key={insight.state} className={`story-row ${selectedState === insight.state ? "selected" : ""}`} onClick={() => onSelectState(insight.state)}><span className={`story-state ${insight.state.toLowerCase()}`}><Sparkles size={13} /></span><span className="story-row-copy"><strong>{insight.title}</strong><small>{insight.timestamp} · {insight.state} · {insight.impact} impact</small></span><ArrowUpRight size={15} /></button>)}</section><section className="evidence-inspector panel"><div className="section-heading"><div><span className="eyebrow">EXPLAINABILITY INSPECTOR</span><h2>Why this matters</h2></div><span className="confidence-chip">{selected.confidence}% illustrative template signal · not calibrated</span></div><div className="inspector-story"><span className={`story-state large ${selected.state.toLowerCase()}`}><Sparkles size={17} /></span><div><span className="state-label">{selected.state} DETECTED</span><h3>{selected.title}</h3><p>{selected.analyst}</p></div></div><div className="inspector-divider"><span>Evidence trail</span></div><div className="inspector-evidence">{selected.evidence.map((item) => <button key={item.label} className={`inspector-evidence-row ${activeEvidence === item.label ? "selected" : ""}`} onClick={() => onSelectEvidence(item.label)}><span className={`evidence-marker ${item.tone}`} /><span><strong>{item.label}</strong><small>{item.value}</small></span><ChevronRight size={14} /></button>)}</div><div className="inspector-footer"><span><Check size={14} /> Source events linked and machine-readable</span><button onClick={onOpenLive}>Jump to live feed <ArrowUpRight size={14} /></button></div></section></div></div>;
}

function PerformanceView({ snapshot, events, match, language, onLanguageChange, onOpenLive }: { snapshot: Snapshot; events: MatchEvent[]; match: LiveMatchInfo | null; language: Language; onLanguageChange: (language: Language) => void; onOpenLive: () => void }) {
  const recentEvents = events.slice().reverse().slice(0, 6);
  return <div className="page"><PageHeader eyebrow={t(language, "perfEyebrow")} title="Every event carries more meaning" description="Match data expanded into team, pass and eventing signals that power richer stories." actions={<button className="secondary-button" onClick={onOpenLive}><Radio size={15} /> {t(language, "returnToLive")}</button>} />
    <section className="performance-hero panel"><div><span className="state-badge control"><span /> {match ? `LIVE FEED · ${match.competition.toUpperCase()}` : "AUTO-EVENTING · SIMULATED"}</span><h2>{snapshot.milestone}</h2><p>{localizedNarrative(snapshot.insight, language)}</p></div><div className="model-readout"><span className="eyebrow">{match ? (match.stats ? "PROVIDER EVENT SIGNAL" : "DERIVED EVENT SIGNAL") : "SYNTHETIC EVENT SIGNAL"}</span><strong>{snapshot.autoEventConfidence}%</strong><small>{match ? (match.stats ? "sourced from live provider statistics" : "derived from the live match timeline; provider statistics unavailable") : "illustrative template signal for this event window; not a calibrated model score"}</small><div className="confidence-bar"><i style={{ width: `${snapshot.autoEventConfidence}%` }} /></div></div></section>
    <div className="performance-metrics"><SignalCard label={t(language, "ballSpeed")} value={`${snapshot.ballSpeedKph} km/h`} detail="Live tracked" accent="mint" /><SignalCard label={t(language, "shotSpeed")} value={`${snapshot.shotSpeedKph} km/h`} detail="Latest shot proxy" accent="coral" /><SignalCard label={t(language, "passQuality")} value={`${snapshot.passQuality}/100`} detail={`${snapshot.passDistanceM}m avg distance`} accent="blue" /><SignalCard label={t(language, "eventSignal")} value={`${snapshot.autoEventConfidence}%`} detail={`${snapshot.distanceCoveredKm.toFixed(1)} km covered`} accent="yellow" /></div>
    <div className="performance-layout"><section className="performance-events panel"><div className="section-heading"><div><span className="eyebrow">EXPANDED DATASET</span><h2>Event intelligence</h2></div><span className="count-chip">{events.length + 18} fields enriched</span></div><div className="performance-table-head"><span>EVENT / PLAYER</span><span>QUALITY</span><span>SPEED</span><span>SIGNAL</span></div><div className="performance-event-list">{recentEvents.map((event) => <PerformanceEventRow key={event.id} event={event} />)}</div></section><section className="performance-side panel"><div className="section-heading"><div><span className="eyebrow">PLAYER IDENTIFICATION</span><h2>Threshold watch</h2></div><UserRound size={16} /></div><div className="threshold-card"><div className="threshold-avatar">MA</div><div><strong>M. Adeyemi</strong><span>CM · demo replay</span><small><span className="verified-dot" />Sprint threshold reached at {snapshot.playerSpeedKph} km/h</small></div><b>SIMULATED</b></div><div className="schema-divider"><span>Generated fields</span></div><div className="schema-list"><SchemaItem label="Pass distance" value={`${snapshot.passDistanceM}m`} /><SchemaItem label="Pass difficulty" value="7 / 10" /><SchemaItem label="Ball speed" value={`${snapshot.ballSpeedKph} km/h`} /><SchemaItem label="Event signal" value={`${snapshot.autoEventConfidence}% · illustrative`} /></div><div className="language-control performance-language"><Globe2 size={14} /><span>Story language</span><LanguageSelect language={language} onLanguageChange={onLanguageChange} /></div></section></div>
  </div>;
}

function SignalCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }) { return <div className="signal-card panel"><span className="eyebrow">{label}</span><strong>{value}</strong><small><span className={`metric-dot ${accent}`} />{detail}</small></div>; }
function PerformanceEventRow({ event }: { event: MatchEvent }) { const quality = event.passQuality ? `${event.passQuality}/100` : event.type === "shot" ? `${event.shotSpeedKph} km/h` : "—"; const speed = event.shotSpeedKph ? `${event.shotSpeedKph} km/h` : event.ballSpeedKph ? `${event.ballSpeedKph} km/h ball` : event.speedKph ? `${event.speedKph} km/h` : "—"; return <div className="performance-event-row"><div><strong>{event.label}</strong><small>{event.player} · {event.zone}</small></div><span>{quality}</span><span>{speed}</span><span className="event-confidence"><i />{event.modelConfidence ?? 92}% synthetic</span></div>; }
function SchemaItem({ label, value }: { label: string; value: string }) { return <div className="schema-item"><span>{label}</span><strong>{value}</strong></div>; }

function RecapsView({ snapshot, events, language, copied, match, hasLiveMatch, liveMatches, selectedLiveId, onSelectLiveMatch, onLanguageChange, onCopy }: { snapshot: Snapshot; events: MatchEvent[]; language: Language; copied: boolean; match: LiveMatchInfo | null; hasLiveMatch: boolean; liveMatches: LiveMatchListItem[]; selectedLiveId: string | null; onSelectLiveMatch: (id: string) => void; onLanguageChange: (language: Language) => void; onCopy: () => void }) {
  const recapText = localizedNarrative(snapshot.insight, language);
  const recapMoments = useMemo(() => events
    .filter((event) => ["goal", "card", "substitution", "halftime", "fulltime"].includes(event.type))
    .slice(-8).reverse()
    .map((event) => ({
      key: event.id,
      time: `${event.minute}:${String(event.second).padStart(2, "0")}`,
      title: translateEventLabel(language, event),
      text: `${event.player} — ${event.outcome}`.slice(0, 150),
      accent: event.type === "goal" ? "coral" : event.type === "card" ? "blue" : "mint",
    })), [events, language]);
  return <div className="page"><PageHeader eyebrow={t(language, "recapsEyebrow")} title={t(language, "recapsTitle")} description="Browse any match from today's Premier League window — the recap, moments and highlights update with your selection." actions={<button className="secondary-button" onClick={onCopy}>{copied ? <Check size={15} /> : <Clipboard size={15} />}{copied ? t(language, "copied") : t(language, "copyRecap")}</button>} />
    {!hasLiveMatch && <div className="nolive-banner" data-testid="recaps-no-live-banner"><Radio size={14} /><span>{t(language, "noLive")}</span></div>}
    <div className="recap-controls">
      <div className="replay-control"><Radio size={14} /><span>{t(language, "pickMatch")}</span><select value={selectedLiveId ?? ""} onChange={(event) => onSelectLiveMatch(event.target.value)} aria-label="Pick a match to recap">{liveMatches.length === 0 && <option value="">Loading fixtures…</option>}{liveMatches.map((item) => <option key={item.id} value={item.id}>{describeLiveMatch(item)}</option>)}</select></div>
      <div className="language-control"><Globe2 size={14} /><LanguageSelect language={language} onLanguageChange={onLanguageChange} /></div>
    </div><section className="recap-hero panel"><div className="recap-hero-copy"><span className="live-tag"><span className="live-dot" /> {t(language, "autoGenerated")}{match ? ` · ${match.competition}` : ""}</span><h2>{snapshot.insight.title}</h2><p>{recapText}</p><div className="recap-tags"><span>{t(language, "whyItMatters")}</span><span>{t(language, "dataSource")}</span><span>{t(language, "evidenceTrail")}</span></div></div><div className="recap-radar"><div className="radar-ring ring-one" /><div className="radar-ring ring-two" /><div className="radar-ring ring-three" /><div className="radar-axis vertical" /><div className="radar-axis horizontal" /><span className="radar-point p-a" /><span className="radar-point p-b" /><span className="radar-point p-c" /></div></section><section className="moments-panel panel"><div className="section-heading"><div><span className="eyebrow">{t(language, "momentsEyebrow")}</span><h2>{t(language, "momentsTitle")}</h2></div><span className="moment-count">{events.length} {t(language, "sourceEvents")}{events.some((event) => event.source === "live") ? " · live" : ""}</span></div><div className="moment-list">{recapMoments.length > 0 ? recapMoments.map((moment) => <Moment key={moment.key} time={moment.time} title={moment.title} text={moment.text} accent={moment.accent} />) : <><Moment time="18:22" title="Northbridge regain the midfield" text="Pressure forced a rushed pass and moved the next action 22 metres closer to goal." accent="mint" /><Moment time="18:30" title="The first shot follows the swing" text="L. Duarte’s shot is the visible output of three connected possessions." accent="coral" /><Moment time="18:46" title="Tempo rises, then settles" text="The match briefly enters a higher-variance phase before Northbridge regain control." accent="blue" /></>}</div></section>{match && match.videos && match.videos.length > 0 && (<section className="panel moments-panel"><div className="section-heading"><div><span className="eyebrow">{t(language, "highlightsEyebrow")}</span><h2>{t(language, "matchClips")}</h2></div><span className="moment-count">{match.videos.length} {t(language, "officialClips")}{match.videos.length === 1 ? "" : "s"}</span></div><div className="moment-list">{match.videos.map((clip) => <a key={clip.id} className="clip-row" href={clip.url} target="_blank" rel="noreferrer"><span className="clip-play">▶</span><span className="clip-copy"><strong>{clip.headline}</strong><small>{clip.description}</small></span><span className="clip-duration">{clip.duration > 0 ? `${Math.floor(clip.duration / 60)}:${String(clip.duration % 60).padStart(2, "0")}` : "clip"}</span></a>)}</div></section>)}</div>;
}

function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions: React.ReactNode }) { return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="page-header-actions">{actions}</div></div>; }
function TeamBlock({ crest, crestUrl, name, label, tone, align = "left" }: { crest: string; crestUrl?: string; name: string; label: string; tone: "mint" | "coral"; align?: "left" | "right" }) { return <div className={`team-block ${align === "right" ? "align-right" : ""}`}><div className={`team-crest ${tone}-crest`}>{crestUrl ? <img src={crestUrl} alt="" loading="lazy" /> : crest}</div><div><strong>{name}</strong><span>{label}</span></div></div>; }
function Metric({ label, value, secondary, trend, accent }: { label: string; value: string; secondary: string; trend: string; accent: string }) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><ArrowUpRight size={13} /></div><div className="metric-main"><strong>{value}</strong><span className={`metric-dot ${accent}`} /></div><div className="metric-bottom"><span>{secondary}</span><b>{trend}</b></div></div>; }
function formatEventSignal(event: MatchEvent) { if (event.type === "pass" && event.distanceM) return ` · ${event.distanceM}m · ${event.passDifficulty}/10 difficulty`; if (event.type === "shot" && event.shotSpeedKph) return ` · ${event.shotSpeedKph} km/h`; if (event.thresholdTriggered) return ` · ${event.thresholdTriggered}`; return ""; }
function EventFeed({ events, selectedEvent, activeEvidence, live, language, onSelect }: { events: MatchEvent[]; selectedEvent: MatchEvent | null; activeEvidence: string | null; live: boolean; language: Language; onSelect: (event: MatchEvent) => void }) { return <section className="event-panel panel"><div className="section-heading"><div><span className="eyebrow">{live ? t(language, "liveIngestion") : "LIVE EVENT INGESTION"}</span><h2>{t(language, "eventStream")}</h2></div><span className="count-chip">{events.length}</span></div><div className="event-filter"><span className="filter-live"><span /> {t(language, "allEvents")}</span><span>{live ? t(language, "matchTimeline") : t(language, "last90")}</span><Search size={13} /></div><div className="event-list">{events.slice().reverse().map((event) => { const evidenceMatch = Boolean(activeEvidence && ((activeEvidence.includes("Pressure") && event.type === "pressure") || (activeEvidence.includes("Turnover") && (event.type === "turnover" || event.outcome.includes("turnover"))) || (activeEvidence.includes("Pass") && event.type === "pass"))); return <button key={event.id} className={`event-row ${selectedEvent?.id === event.id ? "selected" : ""} ${evidenceMatch ? "evidence-match" : ""}`} onClick={() => onSelect(event)}><span className={`event-icon ${event.type}`}><EventIcon type={event.type} /></span><span><strong>{translateEventLabel(language, event)}</strong><small>{event.player} · {event.outcome}{formatEventSignal(event)}</small></span><time>{event.minute}:{String(event.second).padStart(2, "0")}</time></button>; })}</div><div className="event-footer"><Radio size={13} /><span>{live ? t(language, "receivingReal") : t(language, "receivingSynthetic")}</span><b>{live ? t(language, "live") : "1.0x"}</b></div></section>; }
function InsightCard({ insight, language, activeEvidence, onEvidence }: { insight: Insight; language: Language; activeEvidence: string | null; onEvidence: (evidence: string) => void }) { const text = localizedNarrative(insight, language); return <section className="insight-panel panel"><div className="section-heading"><div><span className="eyebrow">{t(language, "whyItMatters")}</span><h2>{t(language, "liveNarrative")}</h2></div><span className="ai-chip"><Sparkles size={13} /> {t(language, "localRules")}</span></div><div className="insight-content"><div className="insight-state"><span className={`state-dot ${insight.state.toLowerCase()}`} />{insight.state} {t(language, "detected")} <b>{insight.confidence}% {t(language, "illustrativeSignal")}</b><small className="confidence-clarifier">Deterministic value; not calibrated model confidence.</small></div><h3>{insight.title}</h3><p>{text}</p><div className="insight-divider"><span>{t(language, "evidenceTrail")}</span></div><div className="evidence-list">{insight.evidence.map((item) => <button key={item.label} className={`evidence-row ${activeEvidence === item.label ? "selected" : ""}`} onClick={() => onEvidence(item.label)}><span className={`evidence-marker ${item.tone}`} /><span><strong>{item.label}</strong><small>{item.value}</small></span><ChevronRight size={14} /></button>)}</div></div><div className="insight-footer"><span><span className="verified-dot" />{t(language, "linkedToSource")}</span><button>{t(language, "openFullTrail")} <ArrowUpRight size={13} /></button></div></section>; }
function PlayerFocus({ favoritePlayer }: { favoritePlayer: string }) { const player = players.find((item) => item.id === favoritePlayer) ?? players[0]; return <section className="player-focus panel"><div className="focus-avatar">{player.name.split(" ").map((part) => part[0]).join("")}</div><div className="focus-main"><span className="eyebrow">PLAYER FOCUS</span><strong>{player.name}</strong><small>{player.position} · demo replay</small></div><div className="focus-divider" /><FocusStat label="Touches" value="42" note="+8 last 5′" /><FocusStat label="Passes" value="31 / 35" note="89% completion" /><FocusStat label="Pressure actions" value="7" note="top in match" /><div className="focus-quote"><span>“</span>He is finding the game between the lines.</div></section>; }
function PipelineCard({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) { return <section className="pipeline-card panel"><div className="section-heading"><div><span className="eyebrow">PERSONALIZATION LAYER</span><h2>One intelligence, many experiences</h2></div><Globe2 size={16} /></div><div className="pipeline-row"><PipelineStep number="01" label="Ingest" status="Live events" /><ChevronRight size={14} /><PipelineStep number="02" label="Interpret" status="Football state" /><ChevronRight size={14} /><PipelineStep number="03" label="Explain" status="Evidence trail" /><ChevronRight size={14} /><PipelineStep number="04" label="Render" status="Overlay-ready" /><ChevronRight size={14} /><PipelineStep number="05" label="Personalize" status="Fan experience" /></div><div className="pipeline-bottom"><span>Output language</span><LanguageSelect language={language} onLanguageChange={onLanguageChange} /><span className="pipeline-ready"><Check size={13} /> All stages healthy</span></div></section>; }
function OverviewStat({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) { return <div className="overview-stat panel"><span className="overview-icon">{icon}</span><span className="overview-label">{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function FocusStat({ label, value, note }: { label: string; value: string; note: string }) { return <div className="focus-stat"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function PipelineStep({ number, label, status }: { number: string; label: string; status: string }) { return <div className="pipeline-step"><span>{number}</span><strong>{label}</strong><small>{status}</small></div>; }
function Moment({ time, title, text, accent }: { time: string; title: string; text: string; accent: string }) { return <div className="moment-row"><time>{time}</time><span className={`moment-marker ${accent}`} /><div><strong>{title}</strong><p>{text}</p></div><ArrowUpRight size={15} /></div>; }
function EventIcon({ type }: { type: MatchEvent["type"] }) { if (type === "shot" || type === "goal") return <Target size={13} />; if (type === "pressure") return <Zap size={13} />; if (type === "tackle" || type === "card") return <CircleHelp size={13} />; if (type === "substitution") return <UserRound size={13} />; if (type === "kickoff" || type === "halftime" || type === "fulltime") return <Radio size={13} />; return <Activity size={13} />; }
function ClockIcon() { return <span className="clock-icon">◷</span>; }

export default App;
