import { Check, Globe2, Radio, Settings2, X } from "lucide-react";
import type { Language } from "./data";
import { t, LANGUAGES } from "./i18n";
import type { LiveMatchInfo } from "./live";

export function SettingsDrawer({ open, onClose, language, onLanguageChange, liveEnabled, onLiveEnabledChange, liveConnected, provider, match }: {
  open: boolean;
  onClose: () => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
  liveEnabled: boolean;
  onLiveEnabledChange: (value: boolean) => void;
  liveConnected: boolean;
  provider: string | null;
  match: LiveMatchInfo | null;
}) {
  if (!open) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="settings-drawer" onClick={(event) => event.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <span className="eyebrow">{t(language, "settingsTitle").toUpperCase()}</span>
            <h2>{t(language, "settingsTitle")}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={15} /></button>
        </header>

        <section className="drawer-section">
          <span className="eyebrow">{t(language, "language")}</span>
          <p className="drawer-note">{t(language, "languageNote")}</p>
          <div className="language-grid">
            {LANGUAGES.map((entry) => (
              <button key={entry.id} className={`language-pill ${language === entry.id ? "selected" : ""}`} onClick={() => onLanguageChange(entry.id)}>
                <Globe2 size={13} /> {entry.label}
                {language === entry.id && <Check size={11} />}
              </button>
            ))}
          </div>
        </section>

        <section className="drawer-section">
          <span className="eyebrow">{t(language, "liveFeed")}</span>
          <div className="drawer-toggle-row">
            <div>
              <strong>{t(language, "liveFeedToggle")}</strong>
              <small>{liveConnected ? t(language, "streamOn") : t(language, "streamOff")}</small>
            </div>
            <button className={`toggle-switch ${liveEnabled ? "on" : ""}`} onClick={() => onLiveEnabledChange(!liveEnabled)} role="switch" aria-checked={liveEnabled} aria-label="Toggle live feed">
              <span />
            </button>
          </div>
          <div className="drawer-kv">
            <span>{t(language, "providerLabel")}</span>
            <b>{(provider ?? "espn").toUpperCase()}</b>
          </div>
          <div className="drawer-kv">
            <span>{t(language, "refreshCadence")}</span>
            <b>{t(language, "every15")}</b>
          </div>
          <div className="drawer-kv">
            <span>{t(language, "currentMatch")}</span>
            <b>{match ? `${match.home.shortName} vs ${match.away.shortName}` : t(language, "noneSelected")}</b>
          </div>
        </section>

        <section className="drawer-section">
          <span className="eyebrow">AI</span>
          <div className="drawer-kv"><span>Ask MatchMind</span><b>Gemini + live feed</b></div>
          <p className="drawer-note"><Radio size={11} className="drawer-inline-icon" /> {t(language, "settingsNote")}</p>
        </section>

        <footer className="drawer-foot">
          <Settings2 size={12} /> MatchMind Live 1.0
        </footer>
      </aside>
    </div>
  );
}

export default SettingsDrawer;
