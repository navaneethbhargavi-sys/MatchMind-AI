import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  Activity, ArrowUpRight, BellRing, Check, ChevronRight, CircleHelp, Clipboard,
  FileText, Gauge, Globe2, LayoutDashboard, MessageCircle, Radio,
  Search, Settings2, Sparkles, Target, UserRound, Zap, Scale, Copy,
} from "lucide-react";
import {
  type Insight, type Language, type MatchEvent, type Snapshot, type TacticalState,
} from "./data";
import { evaluateDecisionOptions, formatDecisionRecommendation, type DecisionAction, type DecisionHorizon } from "./decision";
import { describeLiveMatch, useLiveFeed, type LiveMatchInfo, type LiveMatchListItem } from "./live";
import { AskView } from "./ask-view";
import { SettingsDrawer } from "./settings-drawer";
import { t, translateEventLabel, translateStatus, LANGUAGES } from "./i18n";

type View = "live" | "ask" | "decision" | "recaps" | "performance";

const navItems: { id: View; label: string; short: string; icon: typeof LayoutDashboard }[] = [
  { id: "live", label: "Live studio", short: "LIVE", icon: Radio },
  { id: "ask", label: "Ask MatchMind", short: "ASK", icon: MessageCircle },
  { id: "decision", label: "Decision lab", short: "CHOICES", icon: Scale },
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
  const [language, setLanguage] = useState<Language>("EN");
  const [activeEvidence, setActiveEvidence] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [decisionAction, setDecisionAction] = useState<DecisionAction>("press-higher");
  const [decisionHorizon, setDecisionHorizon] = useState<DecisionHorizon>(5);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const live = useLiveFeed();
  const liveMatch = live.payload?.match ?? null;
  const snapshot = live.payload?.snapshot ?? null;
  const activeEvents = live.payload?.events ?? [];
  const hasLiveMatch = live.matches.some((item) => item.status.state === "in");
  const liveContextLabel = liveMatch ? `${liveMatch.home.shortName} vs ${liveMatch.away.shortName}` : null;
  const ready = Boolean(liveMatch && snapshot);

  function selectEvidence(label: string) { setActiveEvidence(label); setView("live"); }
  async function copyRecap() {
    if (!snapshot) return;
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
        <div className="sidebar-match"><div className="mini-crest mint-crest">PL</div><div><strong>{t(language, "noFixtures")}</strong><span>{live.connected ? "live feed" : "connecting…"}</span></div></div>
      )}
      <div className="sidebar-bottom"><div className="pipeline-status"><span className="status-pulse" /><div><strong>Premier League live feed</strong><span>{live.connected ? `Real events via ${live.provider ?? "espn"}` : "Connecting to live feed…"}</span></div></div><button className="sidebar-settings" onClick={() => setSettingsOpen(true)}><Settings2 size={15} /><span>{t(language, "settings")}</span></button></div>
    </aside>
    <div className="app-frame">
      <header className="app-topbar"><div className="topbar-context"><span className="context-dot" />{t(language, "matchCentre")} <ChevronRight size={13} /><span>{view === "live" ? "Studio view" : navItems.find((item) => item.id === view)?.label}</span></div><div className="topbar-actions"><div className="topbar-stream"><span className="status-pulse" />{live.connected ? t(language, "streamConnected") : t(language, "streamOffline")}</div><button className="topbar-icon" title="Notifications"><BellRing size={16} /></button><button className="topbar-icon" title="Help"><CircleHelp size={16} /></button><span className="topbar-divider" /><button className="profile-button">NM<span /></button></div></header>
      <main className="workspace">
        {view === "live" && <LiveView snapshot={snapshot} events={activeEvents} activeEvidence={activeEvidence} language={language} match={liveMatch} hasLiveMatch={hasLiveMatch} liveMatches={live.matches} selectedLiveId={live.selectedMatchId} liveConnected={live.connected} liveProvider={live.provider} liveError={live.providerError} onSelectLiveMatch={live.selectMatch} onOpenSettings={() => setSettingsOpen(true)} onLanguageChange={setLanguage} onSelectEvent={() => undefined} onSelectEvidence={selectEvidence} onOpenRecaps={() => setView("recaps")} />}
        {view === "ask" && <AskView match={liveMatch} language={language} />}
        {view === "decision" && (ready ? <DecisionLab snapshot={snapshot!} events={activeEvents} liveLabel={liveContextLabel} action={decisionAction} horizon={decisionHorizon} onAction={setDecisionAction} onHorizon={setDecisionHorizon} onCopy={async (text) => { try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); } }} copied={copied} /> : <ConnectingPanel language={language} />)}
        {view === "recaps" && (ready ? <RecapsView snapshot={snapshot!} events={activeEvents} language={language} copied={copied} match={liveMatch} hasLiveMatch={hasLiveMatch} liveMatches={live.matches} selectedLiveId={live.selectedMatchId} onSelectLiveMatch={live.selectMatch} onLanguageChange={setLanguage} onCopy={copyRecap} /> : <ConnectingPanel language={language} />)}
        {view === "performance" && (ready ? <PerformanceView snapshot={snapshot!} events={activeEvents} match={liveMatch} language={language} onLanguageChange={setLanguage} onOpenLive={() => setView("live")} /> : <ConnectingPanel language={language} />)}
      </main>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} language={language} onLanguageChange={setLanguage} liveConnected={live.connected} provider={live.provider} match={liveMatch} />
    </div>
  </div>;
}

function ConnectingPanel({ language }: { language: Language }) {
  return <div className="page"><div className="nolive-banner"><Radio size={14} /><span>{t(language, "connecting")}</span></div></div>;
}

function LiveView({ snapshot, events, activeEvidence, language, match, hasLiveMatch, liveMatches, selectedLiveId, liveConnected, liveProvider, liveError, onSelectLiveMatch, onOpenSettings, onLanguageChange, onSelectEvent, onSelectEvidence, onOpenRecaps }: { snapshot: Snapshot | null; events: MatchEvent[]; activeEvidence: string | null; language: Language; match: LiveMatchInfo | null; hasLiveMatch: boolean; liveMatches: LiveMatchListItem[]; selectedLiveId: string | null; liveConnected: boolean; liveProvider: string | null; liveError: string | null; onSelectLiveMatch: (id: string) => void; onOpenSettings: () => void; onLanguageChange: (language: Language) => void; onSelectEvent: (event: MatchEvent) => void; onSelectEvidence: (label: string) => void; onOpenRecaps: () => void }) {
  const homeName = match?.home.shortName ?? "HOME";
  const awayName = match?.away.shortName ?? "AWAY";
  const stats = match?.stats ?? null;
  const [graphicsCopied, setGraphicsCopied] = useState(false);
  async function copyGraphicsPayload() {
    if (!match) return;
    const payload = {
      contract: "matchmind-graphics/v1",
      matchId: match.id,
      competition: match.competition,
      clock: match.clockDisplay || match.status.detail,
      status: match.status.detail,
      score: `${match.home.name} ${match.home.score} - ${match.away.score} ${match.away.name}`,
      tacticalState: snapshot?.state ?? null,
      headline: snapshot?.insight?.title ?? null,
      evidence: snapshot?.insight?.evidence ?? [],
      possession: snapshot?.possession ?? null,
      source: "live premier league feed",
      generatedAt: new Date().toISOString(),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setGraphicsCopied(true);
      window.setTimeout(() => setGraphicsCopied(false), 1800);
    } catch { /* clipboard unavailable in embedded previews */ }
  }
  return <div className="page live-page"><PageHeader eyebrow="LIVE STUDIO" title="Match intelligence in motion" description="Real Premier League events, turned into stories your studio can use." actions={<button className="primary-button" onClick={onOpenRecaps}><FileText size={15} /> Build recap</button>} />
    {match && !hasLiveMatch && <div className="nolive-banner" data-testid="no-live-banner"><Radio size={14} /><span>{t(language, "noLive")}</span></div>}
    {liveMatches.length === 0 && <div className="nolive-banner" data-testid="no-fixtures-banner"><Radio size={14} /><span>{liveError ? liveError : t(language, "noFixtures")}</span></div>}
    {!match && <div className="nolive-banner"><Radio size={14} /><span>{t(language, "connecting")}</span></div>}
    {match && snapshot ? (<>
      <section className="match-hero panel"><div className="match-hero-top"><span className="live-tag"><span className="live-dot" />{t(language, "live")} · {t(language, "realFeed")}</span><span className="match-id">{`${match.competition.toUpperCase()}${match.venue ? ` · ${match.venue}` : ""}`}</span></div><div className="match-hero-main"><TeamBlock crest={match.home.abbreviation.slice(0, 1) ?? "H"} crestUrl={match.home.crest} name={homeName} label={t(language, "home")} tone="mint" /><div className="hero-score"><div className="score">{match.home.score} <span>—</span> {match.away.score}</div><div className="hero-clock"><ClockIcon />{match.clockDisplay || match.status.detail} <span>{translateStatus(language, match.status.state)}</span></div></div><TeamBlock crest={match.away.abbreviation.slice(0, 1) ?? "A"} crestUrl={match.away.crest} name={awayName} label={t(language, "away")} tone="coral" align="right" /></div><div className="match-hero-bottom"><div className="hero-info"><span>{t(language, "venue")}</span><strong>{match.venue || "Premier League"}</strong></div><div className="hero-info"><span>{t(language, "dataSource")}</span><strong>{(liveProvider ?? "espn").toUpperCase()} · live</strong></div><div className="hero-momentum"><span>{homeName} momentum</span><div className="hero-bars">{[22, 32, 42, 39, 55, 61, 56, 79, 88, 92].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div><strong>+18</strong></div></div></section>
      <div className="control-strip"><div className="replay-control"><Radio size={14} /><span>{t(language, "premierLeague")}</span><select value={selectedLiveId ?? ""} onChange={(event) => onSelectLiveMatch(event.target.value)} aria-label="Live Premier League match">{liveMatches.length === 0 && <option value="">{liveError ? "Live feed unavailable" : "Loading fixtures…"}</option>}{liveMatches.map((item) => <option key={item.id} value={item.id}>{describeLiveMatch(item)}</option>)}</select></div><div className="control-strip-right"><span className="engine-badge"><span /> {`${t(language, "liveData")} · ${(liveProvider ?? "espn").toUpperCase()}${liveConnected ? "" : ` · ${t(language, "reconnecting")}`}`}</span><button className="secondary-button compact" onClick={copyGraphicsPayload} title="Copy machine-readable graphics JSON for playout systems (Vizrt / Chyron / OBS) or second-screen apps"><Clipboard size={14} />{graphicsCopied ? "Copied JSON" : "Copy graphics JSON"}</button><button className="secondary-button compact" onClick={onOpenSettings} title={t(language, "settings")}><Settings2 size={14} />{t(language, "settings")}</button></div></div>
      {stats ? <div className="live-performance-strip"><span><b>{stats.home.shots + stats.away.shots}</b> {t(language, "totalShots")}</span><span><b>{stats.home.shotsOnTarget + stats.away.shotsOnTarget}</b> {t(language, "onTarget")}</span><span><b>{stats.home.corners + stats.away.corners}</b> {t(language, "corners")}</span><span><b>{stats.home.fouls + stats.away.fouls}</b> {t(language, "fouls")}</span><span><b>{stats.home.possession}% / {stats.away.possession}%</b> {t(language, "possessionSplit")}</span></div> : null}
      <div className="metric-grid"><Metric label={t(language, "possession")} value={`${snapshot.possession[0]}%`} secondary={`${snapshot.possession[1]}% ${awayName}`} trend={stats ? t(language, "provider") : t(language, "derived")} accent="mint" /><Metric label={t(language, "passCompletion")} value={`${snapshot.passCompletion[0]}%`} secondary={`${snapshot.passCompletion[1]}% ${awayName}`} trend={stats ? t(language, "provider") : t(language, "derived")} accent="blue" /><Metric label={t(language, "pressureIndex")} value={`${snapshot.pressure}`} secondary={`${homeName} live score`} trend={t(language, "derived")} accent="coral" /><Metric label={t(language, "matchTempo")} value={`${snapshot.tempo}`} secondary="derived from real events" trend={t(language, "derived")} accent="yellow" /></div>
      <section className="live-grid"><EventFeed events={events} activeEvidence={activeEvidence} live language={language} onSelect={onSelectEvent} /><InsightCard insight={snapshot.insight} language={language} activeEvidence={activeEvidence} onEvidence={onSelectEvidence} /></section>
      <section className="bottom-grid"><PipelineCard language={language} onLanguageChange={onLanguageChange} /></section>
    </>) : null}
  </div>;
}

function DecisionLab({ snapshot, events, liveLabel, action, horizon, onAction, onHorizon, onCopy, copied }: { snapshot: Snapshot; events: MatchEvent[]; liveLabel: string | null; action: DecisionAction; horizon: DecisionHorizon; onAction: (action: DecisionAction) => void; onHorizon: (horizon: DecisionHorizon) => void; onCopy: (text: string) => void; copied: boolean }) {
  const options = useMemo(() => evaluateDecisionOptions(snapshot, events, horizon), [snapshot, events, horizon]);
  const selected = options.find((option) => option.action === action) ?? options[0];
  const recommendation = formatDecisionRecommendation(selected, horizon);
  const labels: Record<DecisionAction, string> = { "press-higher": "Press higher", "hold-shape": "Hold shape", "attack-wide": "Attack wide" };
  return <div className="page decision-page">
    <PageHeader eyebrow="DECISION LAB" title="Compare the next coaching move" description="Read the current match, then test three tactical choices against the same recent evidence." actions={<span className="decision-run-badge"><span /> {liveLabel ? "LIVE CONTEXT · RULES-BASED SIGNALS" : "LIVE CONTEXT"}</span>} />
    <section className="decision-context panel" data-testid="decision-context">
      <div className="decision-context-main"><span className="eyebrow">CURRENT MATCH CONTEXT</span><strong>{liveLabel} <i>·</i> {formatClock(snapshot.clock)} <i>·</i> {snapshot.state}</strong><p>{snapshot.insight.title}</p></div>
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

function PerformanceView({ snapshot, events, match, language, onLanguageChange, onOpenLive }: { snapshot: Snapshot; events: MatchEvent[]; match: LiveMatchInfo | null; language: Language; onLanguageChange: (language: Language) => void; onOpenLive: () => void }) {
  const recentEvents = events.slice().reverse().slice(0, 8);
  const stats = match?.stats ?? null;
  return <div className="page"><PageHeader eyebrow={t(language, "perfEyebrow")} title="Every event carries more meaning" description="Real match signals expanded with their provenance - what the provider measured and what MatchMind derived." actions={<button className="secondary-button" onClick={onOpenLive}><Radio size={15} /> {t(language, "returnToLive")}</button>} />
    <section className="performance-hero panel"><div><span className="state-badge control"><span /> {match ? `LIVE FEED · ${match.competition.toUpperCase()}` : "LIVE FEED"}</span><h2>{snapshot.milestone}</h2><p>{localizedNarrative(snapshot.insight, language)}</p></div><div className="model-readout"><span className="eyebrow">{match?.stats ? "PROVIDER EVENT SIGNAL" : "DERIVED EVENT SIGNAL"}</span><strong>{snapshot.autoEventConfidence}%</strong><small>{match?.stats ? "sourced from live provider statistics" : "derived from the live match timeline; provider statistics unavailable"}</small><div className="confidence-bar"><i style={{ width: `${snapshot.autoEventConfidence}%` }} /></div></div></section>
    {stats ? <div className="performance-metrics"><SignalCard label={`${match?.home.shortName ?? "Home"} possession`} value={`${stats.home.possession}%`} detail="provider statistic" accent="mint" /><SignalCard label={`${match?.home.shortName ?? "Home"} shots`} value={`${stats.home.shots} (${stats.home.shotsOnTarget})`} detail="on target in brackets" accent="coral" /><SignalCard label={`${match?.away.shortName ?? "Away"} possession`} value={`${stats.away.possession}%`} detail="provider statistic" accent="blue" /><SignalCard label={`${match?.away.shortName ?? "Away"} shots`} value={`${stats.away.shots} (${stats.away.shotsOnTarget})`} detail="on target in brackets" accent="yellow" /></div> : null}
    <div className="performance-metrics"><SignalCard label={t(language, "pressureIndex")} value={`${snapshot.pressure}`} detail="derived from real events" accent="coral" /><SignalCard label={t(language, "matchTempo")} value={`${snapshot.tempo}`} detail="derived from real events" accent="yellow" /><SignalCard label="Territory" value={`${snapshot.territory}%`} detail="derived from real events" accent="mint" /><SignalCard label="Tactical state" value={snapshot.state} detail={`evidence: ${(snapshot.insight.evidence[0]?.value ?? "").slice(0, 28)}`} accent="blue" /></div>
    <div className="performance-layout"><section className="performance-events panel"><div className="section-heading"><div><span className="eyebrow">LIVE EVENT INTELLIGENCE</span><h2>Recent events</h2></div><span className="count-chip">{events.length} events</span></div><div className="performance-table-head"><span>EVENT / PLAYER</span><span>TYPE</span><span>TEAM</span><span>MINUTE</span></div><div className="performance-event-list">{recentEvents.map((event) => <div className="performance-event-row" key={event.id}><div><strong>{translateEventLabel(language, event)}</strong><small>{event.player} · {event.outcome}</small></div><span>{event.type}</span><span>{event.team === "home" ? (match?.home.shortName ?? "home") : (match?.away.shortName ?? "away")}</span><span>{event.minute}'</span></div>)}</div></section><section className="performance-side panel"><div className="section-heading"><div><span className="eyebrow">SIGNAL PROVENANCE</span><h2>Real vs derived</h2></div><Globe2 size={16} /></div><div className="schema-list" style={{ paddingTop: 0 }}><SchemaItem label="Score, clock, status" value="real" /><SchemaItem label="Goals, cards, subs" value="real" /><SchemaItem label="Possession, shots, passes" value={match?.stats ? "real (provider)" : "derived"} /><SchemaItem label="Pressure, tempo, territory" value="derived" /><SchemaItem label="Tactical state" value="rules over real data" /></div><div className="language-control performance-language"><Globe2 size={14} /><span>Story language</span><LanguageSelect language={language} onLanguageChange={onLanguageChange} /></div></section></div>
  </div>;
}

function SignalCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }) { return <div className="signal-card panel"><span className="eyebrow">{label}</span><strong>{value}</strong><small><span className={`metric-dot ${accent}`} />{detail}</small></div>; }
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
  return <div className="page"><PageHeader eyebrow={t(language, "recapsEyebrow")} title={t(language, "recapsTitle")} description="Browse any fixture from the Premier League window — the recap, moments and highlights update with your selection." actions={<button className="secondary-button" onClick={onCopy}>{copied ? <Check size={15} /> : <Clipboard size={15} />}{copied ? t(language, "copied") : t(language, "copyRecap")}</button>} />
    {!hasLiveMatch && <div className="nolive-banner" data-testid="recaps-no-live-banner"><Radio size={14} /><span>{t(language, "noLive")}</span></div>}
    <div className="recap-controls">
      <div className="replay-control"><Radio size={14} /><span>{t(language, "pickMatch")}</span><select value={selectedLiveId ?? ""} onChange={(event) => onSelectLiveMatch(event.target.value)} aria-label="Pick a match to recap">{liveMatches.length === 0 && <option value="">Loading fixtures…</option>}{liveMatches.map((item) => <option key={item.id} value={item.id}>{describeLiveMatch(item)}</option>)}</select></div>
      <div className="language-control"><Globe2 size={14} /><LanguageSelect language={language} onLanguageChange={onLanguageChange} /></div>
    </div><section className="recap-hero panel"><div className="recap-hero-copy"><span className="live-tag"><span className="live-dot" /> {t(language, "autoGenerated")}{match ? ` · ${match.competition}` : ""}</span><h2>{snapshot.insight.title}</h2><p>{recapText}</p><div className="recap-tags"><span>{t(language, "whyItMatters")}</span><span>{t(language, "dataSource")}</span><span>{t(language, "evidenceTrail")}</span></div></div><div className="recap-radar"><div className="radar-ring ring-one" /><div className="radar-ring ring-two" /><div className="radar-ring ring-three" /><div className="radar-axis vertical" /><div className="radar-axis horizontal" /><span className="radar-point p-a" /><span className="radar-point p-b" /><span className="radar-point p-c" /></div></section><section className="moments-panel panel"><div className="section-heading"><div><span className="eyebrow">{t(language, "momentsEyebrow")}</span><h2>{t(language, "momentsTitle")}</h2></div><span className="moment-count">{events.length} {t(language, "sourceEvents")}</span></div><div className="moment-list">{recapMoments.length > 0 ? recapMoments.map((moment) => <Moment key={moment.key} time={moment.time} title={moment.title} text={moment.text} accent={moment.accent} />) : <div className="decision-no-evidence" style={{ padding: "16px 0" }}>No key moments recorded in the current window yet.</div>}</div></section>{match && match.videos && match.videos.length > 0 && (<section className="panel moments-panel"><div className="section-heading"><div><span className="eyebrow">{t(language, "highlightsEyebrow")}</span><h2>{t(language, "matchClips")}</h2></div><span className="moment-count">{match.videos.length} {t(language, "officialClips")}{match.videos.length === 1 ? "" : "s"}</span></div><div className="moment-list">{match.videos.map((clip) => <a key={clip.id} className="clip-row" href={clip.url} target="_blank" rel="noreferrer"><span className="clip-play">▶</span><span className="clip-copy"><strong>{clip.headline}</strong><small>{clip.description}</small></span><span className="clip-duration">{clip.duration > 0 ? `${Math.floor(clip.duration / 60)}:${String(clip.duration % 60).padStart(2, "0")}` : "clip"}</span></a>)}</div></section>)}</div>;
}

function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions: React.ReactNode }) { return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="page-header-actions">{actions}</div></div>; }
function TeamBlock({ crest, crestUrl, name, label, tone, align = "left" }: { crest: string; crestUrl?: string; name: string; label: string; tone: "mint" | "coral"; align?: "left" | "right" }) { return <div className={`team-block ${align === "right" ? "align-right" : ""}`}><div className={`team-crest ${tone}-crest`}>{crestUrl ? <img src={crestUrl} alt="" loading="lazy" /> : crest}</div><div><strong>{name}</strong><span>{label}</span></div></div>; }
function Metric({ label, value, secondary, trend, accent }: { label: string; value: string; secondary: string; trend: string; accent: string }) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><ArrowUpRight size={13} /></div><div className="metric-main"><strong>{value}</strong><span className={`metric-dot ${accent}`} /></div><div className="metric-bottom"><span>{secondary}</span><b>{trend}</b></div></div>; }
function EventFeed({ events, activeEvidence, live, language, onSelect }: { events: MatchEvent[]; activeEvidence: string | null; live: boolean; language: Language; onSelect: (event: MatchEvent) => void }) { return <section className="event-panel panel"><div className="section-heading"><div><span className="eyebrow">{live ? t(language, "liveIngestion") : "LIVE EVENT INGESTION"}</span><h2>{t(language, "eventStream")}</h2></div><span className="count-chip">{events.length}</span></div><div className="event-filter"><span className="filter-live"><span /> {t(language, "allEvents")}</span><span>{live ? t(language, "matchTimeline") : t(language, "last90")}</span><Search size={13} /></div><div className="event-list">{events.slice().reverse().map((event) => { const evidenceMatch = Boolean(activeEvidence && ((activeEvidence.includes("Pressure") && event.type === "pressure") || (activeEvidence.includes("Turnover") && (event.type === "turnover" || event.outcome.includes("turnover"))) || (activeEvidence.includes("Pass") && event.type === "pass"))); return <button key={event.id} className={`event-row ${evidenceMatch ? "evidence-match" : ""}`} onClick={() => onSelect(event)}><span className={`event-icon ${event.type}`}><EventIcon type={event.type} /></span><span><strong>{translateEventLabel(language, event)}</strong><small>{event.player} · {event.outcome}</small></span><time>{event.minute}:{String(event.second).padStart(2, "0")}</time></button>; })}</div><div className="event-footer"><Radio size={13} /><span>{t(language, "receivingReal")}</span><b>{t(language, "live")}</b></div></section>; }
function InsightCard({ insight, language, activeEvidence, onEvidence }: { insight: Insight; language: Language; activeEvidence: string | null; onEvidence: (evidence: string) => void }) { const text = localizedNarrative(insight, language); return <section className="insight-panel panel"><div className="section-heading"><div><span className="eyebrow">{t(language, "whyItMatters")}</span><h2>{t(language, "liveNarrative")}</h2></div><span className="ai-chip"><Sparkles size={13} /> {t(language, "localRules")}</span></div><div className="insight-content"><div className="insight-state"><span className={`state-dot ${insight.state.toLowerCase()}`} />{insight.state} {t(language, "detected")} <b>{insight.confidence}% {t(language, "illustrativeSignal")}</b><small className="confidence-clarifier">Deterministic value; not calibrated model confidence.</small></div><h3>{insight.title}</h3><p>{text}</p><div className="insight-divider"><span>{t(language, "evidenceTrail")}</span></div><div className="evidence-list">{insight.evidence.map((item) => <button key={item.label} className={`evidence-row ${activeEvidence === item.label ? "selected" : ""}`} onClick={() => onEvidence(item.label)}><span className={`evidence-marker ${item.tone}`} /><span><strong>{item.label}</strong><small>{item.value}</small></span><ChevronRight size={14} /></button>)}</div></div><div className="insight-footer"><span><span className="verified-dot" />{t(language, "linkedToSource")}</span><button>{t(language, "openFullTrail")} <ArrowUpRight size={13} /></button></div></section>; }
function PipelineCard({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) { return <section className="pipeline-card panel"><div className="section-heading"><div><span className="eyebrow">PERSONALIZATION LAYER</span><h2>One intelligence, many experiences</h2></div><Globe2 size={16} /></div><div className="pipeline-row"><PipelineStep number="01" label="Ingest" status="Live events" /><ChevronRight size={14} /><PipelineStep number="02" label="Interpret" status="Football state" /><ChevronRight size={14} /><PipelineStep number="03" label="Explain" status="Evidence trail" /><ChevronRight size={14} /><PipelineStep number="04" label="Render" status="Overlay-ready" /><ChevronRight size={14} /><PipelineStep number="05" label="Personalize" status="Fan experience" /></div><div className="pipeline-bottom"><span>Output language</span><LanguageSelect language={language} onLanguageChange={onLanguageChange} /><span className="pipeline-ready"><Check size={13} /> All stages healthy</span></div></section>; }
function PipelineStep({ number, label, status }: { number: string; label: string; status: string }) { return <div className="pipeline-step"><span>{number}</span><strong>{label}</strong><small>{status}</small></div>; }
function Moment({ time, title, text, accent }: { time: string; title: string; text: string; accent: string }) { return <div className="moment-row"><time>{time}</time><span className={`moment-marker ${accent}`} /><div><strong>{title}</strong><p>{text}</p></div><ArrowUpRight size={15} /></div>; }
function EventIcon({ type }: { type: MatchEvent["type"] }) { if (type === "shot" || type === "goal") return <Target size={13} />; if (type === "pressure") return <Zap size={13} />; if (type === "tackle" || type === "card") return <CircleHelp size={13} />; if (type === "substitution") return <UserRound size={13} />; if (type === "kickoff" || type === "halftime" || type === "fulltime") return <Radio size={13} />; return <Activity size={13} />; }
function ClockIcon() { return <span className="clock-icon">◷</span>; }

export default App;
