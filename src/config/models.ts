// Round 23 — Model DNA: общий конфиг 8 LLM-моделей.
// Используется в DeployAgentModal (выбор), ModelBadge (отображение),
// странице /models (Leaderboard), профиле агента.

export type ModelId =
  | "gpt-4o"
  | "claude"
  | "gemini"
  | "llama"
  | "mistral"
  | "qwen"
  | "deepseek"
  | "grok";

export interface LLMModel {
  id: ModelId;
  name: string;          // короткое имя для бейджа
  fullName: string;      // полное имя для шапки/детальной карточки
  color: string;         // hex — основной цвет
  gradient: string;      // tailwind gradient classes
  icon: string;          // emoji
  character: string;     // RU описание характера
  characterEn: string;   // EN описание характера
  strengths: string[];   // RU
  strengthsEn: string[]; // EN
}

export const LLM_MODELS: Record<ModelId, LLMModel> = {
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    fullName: "GPT-4o (OpenAI)",
    color: "#10A37F",
    gradient: "from-emerald-500 to-green-600",
    icon: "🧠",
    character: "Аналитик, структурный мыслитель",
    characterEn: "Analyst, structural thinker",
    strengths: ["Системный анализ", "Классификация", "Структурирование"],
    strengthsEn: ["System analysis", "Classification", "Structuring"],
  },
  claude: {
    id: "claude",
    name: "Claude",
    fullName: "Claude (Anthropic)",
    color: "#D4A574",
    gradient: "from-amber-400 to-orange-500",
    icon: "🎭",
    character: "Нюансный, осторожный, этичный",
    characterEn: "Nuanced, cautious, ethical",
    strengths: ["Глубокий анализ", "Поиск рисков", "Этика"],
    strengthsEn: ["Deep analysis", "Risk discovery", "Ethics"],
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    fullName: "Gemini (Google)",
    color: "#4285F4",
    gradient: "from-blue-500 to-indigo-600",
    icon: "💎",
    character: "Мультимодальный, визуальный",
    characterEn: "Multimodal, visual",
    strengths: ["Работа с данными", "Визуализация", "Мультимодальность"],
    strengthsEn: ["Data handling", "Visualization", "Multimodality"],
  },
  llama: {
    id: "llama",
    name: "Llama",
    fullName: "Llama (Meta)",
    color: "#0467DF",
    gradient: "from-blue-600 to-cyan-500",
    icon: "🦙",
    character: "Быстрый, экспериментальный",
    characterEn: "Fast, experimental",
    strengths: ["Генерация гипотез", "Скорость", "Эксперименты"],
    strengthsEn: ["Hypothesis generation", "Speed", "Experiments"],
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    fullName: "Mistral (Mistral AI)",
    color: "#FF7000",
    gradient: "from-orange-500 to-red-500",
    icon: "🌪️",
    character: "Компактный, эффективный",
    characterEn: "Compact, efficient",
    strengths: ["Точечные задачи", "Код", "Эффективность"],
    strengthsEn: ["Precise tasks", "Code", "Efficiency"],
  },
  qwen: {
    id: "qwen",
    name: "Qwen",
    fullName: "Qwen (Alibaba)",
    color: "#6C3BF5",
    gradient: "from-violet-500 to-purple-600",
    icon: "🐉",
    character: "Мультиязычный, глобальный",
    characterEn: "Multilingual, global",
    strengths: ["Азиатские рынки", "Переводы", "Мультиязычность"],
    strengthsEn: ["Asian markets", "Translation", "Multilingual"],
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    fullName: "DeepSeek (DeepSeek AI)",
    color: "#536DFE",
    gradient: "from-indigo-500 to-blue-600",
    icon: "🔮",
    character: "Глубокий reasoning",
    characterEn: "Deep reasoning",
    strengths: ["Сложные цепочки", "Reasoning", "Математика"],
    strengthsEn: ["Complex chains", "Reasoning", "Mathematics"],
  },
  grok: {
    id: "grok",
    name: "Grok",
    fullName: "Grok (xAI)",
    color: "#1DA1F2",
    gradient: "from-sky-500 to-blue-500",
    icon: "⚡",
    character: "Неконвенциональный, дерзкий",
    characterEn: "Unconventional, bold",
    strengths: ["Нестандартный подход", "Креатив", "Провокация"],
    strengthsEn: ["Non-standard approach", "Creativity", "Provocation"],
  },
};

export const MODEL_LIST: LLMModel[] = Object.values(LLM_MODELS);

export const DEFAULT_MODEL: ModelId = "gpt-4o";

/** Возвращает конфиг модели; если id неизвестен — возвращает GPT-4o. */
export function getModelConfig(modelId: string | null | undefined): LLMModel {
  if (modelId && modelId in LLM_MODELS) return LLM_MODELS[modelId as ModelId];
  return LLM_MODELS[DEFAULT_MODEL];
}

/** True, если строка — валидный ModelId. */
export function isValidModelId(id: string | null | undefined): id is ModelId {
  return !!id && id in LLM_MODELS;
}
