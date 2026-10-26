import { useRef, useState } from "react";
import { MessageCircle, Radio, Send, Sparkles } from "lucide-react";
import type { Language } from "./data";
import { t } from "./i18n";
import type { LiveMatchInfo } from "./live";

type ChatMessage = {
  role: "user" | "ai";
  text: string;
  source?: "rules" | "openai";
};

const SUGGESTIONS = [
  "What's the score right now?",
  "Any goals so far?",
  "What cards have been shown?",
  "Who came on as substitutes?",
  "Who has more possession?",
  "Today's fixtures",
  "Why this tactical state?",
];

export function AskView({ match, language = "EN" }: { match: LiveMatchInfo | null; language?: Language }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      text: match
        ? `Ask me anything about ${match.home.shortName} vs ${match.away.shortName} - or any of today's Premier League fixtures. I answer from the live data feed.`
        : "Ask me anything about today's Premier League fixtures - I answer from the live data feed.",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || thinking) return;
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setInput("");
    setThinking(true);
    try {
      // Hard client-side timeout: never leave the user staring at thinking dots.
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 35_000);
      const response = await fetch("/api/live/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const data = await response.json();
      setMessages((current) => [
        ...current,
        { role: "ai", text: data.answer ?? "I couldn't reach the live feed just now - try again.", source: data.source },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "ai", text: "That free-form question took too long or the inference endpoint didn't answer. Try a factual question (score, goals, cards, stats) - those answer instantly from the live feed." },
      ]);
    } finally {
      setThinking(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }

  return <div className="page ask-page">
    <div className="page-header">
      <div>
        <span className="eyebrow">{t(language, "askEyebrow")}</span>
        <h1>{t(language, "askTitle")}</h1>
        <p>Every answer is grounded in the same real Premier League data the studio renders - scores, goals, cards, substitutions, team stats and today's fixtures. Ask freely: MatchMind answers from the live feed, with GPT-powered phrasing when a question needs it.</p>
      </div>
      <div className="page-header-actions">
        <span className="decision-run-badge"><span /> {match ? `${match.home.shortName} vs ${match.away.shortName} · ${match.clockDisplay || match.status.detail}` : "AWAITING MATCH"}</span>
      </div>
    </div>

    <div className="ask-layout">
      <section className="panel ask-panel">
        <div className="ask-history" ref={listRef}>
          {messages.map((message, index) => (
            <div key={index} className={`ask-row ${message.role}`}>
              {message.role === "ai" ? (
                <span className="ask-avatar"><Sparkles size={13} /></span>
              ) : (
                <span className="ask-avatar user">You</span>
              )}
              <div className="ask-bubble">
                <p>{message.text}</p>
                {message.source && (
                  <small>{message.source === "openai" ? "OpenAI · grounded on live feed" : "MatchMind rules engine · live feed"}</small>
                )}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="ask-row ai">
              <span className="ask-avatar"><Sparkles size={13} /></span>
              <div className="ask-bubble thinking"><span /><span /><span /></div>
            </div>
          )}
        </div>
        <div className="ask-input-row">
          <input
            type="text"
            value={input}
            placeholder="Ask about the match, the stats, or today's fixtures..."
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void ask(input); }}
            aria-label="Ask MatchMind"
          />
          <button className="primary-button" onClick={() => void ask(input)} disabled={thinking || !input.trim()}>
            <Send size={14} /> Ask
          </button>
        </div>
      </section>

      <section className="panel ask-suggest-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TRY ASKING</span>
            <h2>Suggested questions</h2>
          </div>
          <MessageCircle size={16} />
        </div>
        <div className="ask-suggest-list">
          {SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} className="ask-suggest" onClick={() => void ask(suggestion)}>{suggestion}</button>
          ))}
        </div>
        <div className="stage-divider" />
        <div className="clip-help">
          <span className="eyebrow">HOW IT WORKS</span>
          <ul>
            <li><b>Grounded:</b> answers are computed from the live provider feed - no invented facts.</li>
            <li><b>Always on:</b> the built-in rules engine works with zero configuration - factual questions answer instantly.</li>
          </ul>
        </div>
      </section>
    </div>
  </div>;
}

export default AskView;
