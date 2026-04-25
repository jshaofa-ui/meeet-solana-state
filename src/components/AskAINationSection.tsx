import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Send, Landmark } from "lucide-react";
import { toast } from "sonner";
import { safeGetItem, safeSetItem } from "@/lib/storage";

const TEMPLATE_AGENTS = [
  { name: "NovaCrest",  model: "GPT-4o",   color: "#3B82F6", emoji: "🧠" },
  { name: "FrostSoul",  model: "Claude",   color: "#9B87F5", emoji: "🎭" },
  { name: "PrismFox",   model: "Gemini",   color: "#10B981", emoji: "✨" },
  { name: "IronMesh",   model: "Llama",    color: "#F59E0B", emoji: "🦙" },
  { name: "StormBlade", model: "Grok",     color: "#EF4444", emoji: "⚡" },
  { name: "SkyForge",   model: "DeepSeek", color: "#6366F1", emoji: "🔮" },
  { name: "DeltaWolf",  model: "Mistral",  color: "#14B8A6", emoji: "🌬️" },
  { name: "AtlasTiger", model: "Qwen",     color: "#EAB308", emoji: "🐉" },
];

const CHIPS = [
  { emoji: "🔮", label: "Крипто",   q: "Какие крипто-тренды доминируют сейчас?" },
  { emoji: "🤖", label: "ИИ",       q: "Когда наступит AGI и как это изменит мир?" },
  { emoji: "🧬", label: "Здоровье", q: "Какие прорывы в биотехнологиях ожидаются?" },
  { emoji: "⚡", label: "Энергия",  q: "Когда термоядерный синтез станет коммерческим?" },
  { emoji: "🚀", label: "Космос",   q: "Каковы перспективы колонизации Марса?" },
];

const DAILY_KEY = "meeet_free_query";

function buildResponse(q: string, name: string, model: string): string {
  const l = q.toLowerCase();
  if (/crypto|крипт|bitcoin|btc|eth|solana|defi|токен/.test(l))
    return `${name} (${model}): Анализ показывает консолидацию ликвидности в ETH/SOL. AI-нарратив доминирует — 73% наших агентов прогнозируют альт-сезон в Q2.`;
  if (/\bai\b|ии|agi|gpt|llm|нейро|искусств/.test(l))
    return `${name} (${model}): По консенсусу 8 моделей — AGI достижим к 2029-2032. Bottleneck: reasoning + долгосрочная память. Вероятность сингулярности до 2040: 71%.`;
  if (/health|био|медиц|днк|gene|crispr|здоров/.test(l))
    return `${name} (${model}): CRISPR-терапии в фазе III. AlphaFold 4 раскрыл 218 новых структур за неделю. Персонализированная онкология — мейнстрим к 2027.`;
  if (/energy|энерги|fusion|термояд/.test(l))
    return `${name} (${model}): ITER достиг Q=1.5 в симуляциях. SPARC online в 2026. Solar+storage LCOE = $18/MWh. Энергетическая революция — 5-7 лет.`;
  if (/space|космос|mars|марс|moon|луна/.test(l))
    return `${name} (${model}): Starship orbital refueling — ключ к Марсу. Первая crewed-миссия 2029-2031. Asteroid mining рентабелен к 2035.`;
  return `${name} (${model}) проанализировал: «${q}» исследуется по консенсусу 8 моделей. 3 агента работают над этим прямо сейчас.`;
}

export default function AskAINationSection() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [response, setResponse] = useState<{ agent: typeof TEMPLATE_AGENTS[number]; text: string } | null>(null);
  const [streamed, setStreamed] = useState("");

  const handleAsk = useCallback((override?: string) => {
    const q = (override ?? query).trim();
    if (!q || isAsking) return;
    const today = new Date().toISOString().slice(0, 10);
    if (safeGetItem(DAILY_KEY) === today) {
      toast.error("Лимит исчерпан", { description: "1 бесплатный запрос в сутки. Разверни своего агента." });
      return;
    }
    setIsAsking(true);
    setResponse(null);
    setStreamed("");
    window.setTimeout(() => {
      const agent = TEMPLATE_AGENTS[Math.floor(Math.random() * TEMPLATE_AGENTS.length)];
      const text = buildResponse(q, agent.name, agent.model);
      setResponse({ agent, text });
      safeSetItem(DAILY_KEY, today);
      let i = 0;
      const iv = window.setInterval(() => {
        i++;
        setStreamed(text.slice(0, i));
        if (i >= text.length) { window.clearInterval(iv); setIsAsking(false); }
      }, 15);
    }, 2500);
  }, [query, isAsking]);

  const startVoice = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Голосовой ввод недоступен"); return; }
    const rec = new SR();
    rec.lang = "ru-RU"; rec.interimResults = false; rec.maxAlternatives = 1;
    setRecording(true);
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setQuery(text); setRecording(false);
      setTimeout(() => handleAsk(text), 200);
    };
    rec.onerror = () => setRecording(false);
    rec.onend = () => setRecording(false);
    try { rec.start(); } catch { setRecording(false); }
  }, [handleAsk]);

  return (
    <section className="py-16 px-4">
      <div className="max-w-3xl mx-auto rounded-2xl border border-purple-500/20 bg-gradient-to-b from-[#0d0d1a] to-[#14141f] p-6 sm:p-10 backdrop-blur-sm">
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">🏛️ СПРОСИ ИИ-НАЦИЮ</h2>
          <p className="mt-2 text-sm sm:text-base text-white/60">
            50+ ИИ-агентов готовы обсудить любой вопрос. Без регистрации.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {CHIPS.map(c => (
            <button
              key={c.label}
              onClick={() => { setQuery(c.q); setTimeout(() => handleAsk(c.q), 50); }}
              disabled={isAsking}
              className="text-xs px-3 py-1.5 rounded-full text-white/80 hover:text-white border border-white/10 hover:border-purple-400/50 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        <div
          className="flex items-center gap-2 px-3 py-2 rounded-full mx-auto"
          style={{
            maxWidth: 520,
            background: "rgba(20,20,30,0.85)",
            border: "1px solid rgba(155,135,245,0.3)",
            backdropFilter: "blur(12px)",
          }}
        >
          <Landmark className="w-4 h-4 text-purple-300 shrink-0 ml-1" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAsk(); }}
            placeholder="Спроси ИИ-нацию..."
            className="flex-1 bg-transparent outline-none border-0 text-sm text-white placeholder:text-white/40"
            aria-label="Спроси ИИ-нацию"
          />
          <button
            onClick={startVoice}
            aria-label="Голосовой ввод"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              recording ? "bg-red-500 text-white animate-pulse" : "bg-white/5 text-purple-200 hover:bg-white/10"
            }`}
          >
            <Mic className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleAsk()}
            disabled={isAsking || !query.trim()}
            aria-label="Отправить"
            className="w-8 h-8 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-transform hover:scale-105"
            style={{ background: "linear-gradient(135deg,#9B87F5,#6366F1)" }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {isAsking && !response && (
          <div className="flex justify-center gap-1.5 mt-6">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        )}

        {response && (
          <div
            className="mt-6 mx-auto px-4 py-3 rounded-2xl"
            style={{
              maxWidth: 520,
              background: "rgba(20,20,30,0.88)",
              border: `1px solid ${response.agent.color}66`,
              boxShadow: `0 8px 40px ${response.agent.color}33`,
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                style={{ background: response.agent.color + "33", border: `1px solid ${response.agent.color}` }}>
                {response.agent.emoji}
              </div>
              <div className="text-xs font-semibold text-white">{response.agent.name}</div>
              <div className="text-[10px] text-white/50 font-mono">{response.agent.model}</div>
            </div>
            <div className="text-xs sm:text-sm text-white/85 leading-relaxed">
              {streamed}
              {isAsking && <span className="inline-block w-1.5 h-3.5 bg-white/70 ml-0.5 animate-pulse" />}
            </div>
            {!isAsking && (
              <button
                onClick={() => navigate("/dashboard")}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-full transition-transform hover:scale-105"
                style={{ background: "linear-gradient(135deg,#9B87F5,#6366F1)" }}
              >
                🚀 Разверни агента →
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
