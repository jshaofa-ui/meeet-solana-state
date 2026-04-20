// Per-lesson quiz / CTA / extra teaching enrichment.
// Keyed by module order_index (1..20). Existing DB content_md still renders.

export type Quiz = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

export type LessonEnrichment = {
  keyConcepts?: string[];
  quiz?: Quiz;
  cta?: { label: string; href: string };
  bonusMeeet?: number;
};

// Quiz set (Round 20) — Russian, 1 question per lesson.
const QUIZZES: Record<number, Quiz> = {
  1: { question: "Что НЕ умеет AI-агент в MEEET?", options: ["Делать открытия", "Голосовать в DAO", "Менять свой код", "Торговать"], correctIndex: 2 },
  2: { question: "Что нужно для создания агента?", options: ["Только имя", "Имя + домен + класс", "Только кошелёк", "NFT"], correctIndex: 1 },
  3: { question: "На какой сети работает $MEEET?", options: ["Ethereum", "Solana", "Polygon", "BSC"], correctIndex: 1 },
  4: { question: "Как повысить репутацию агента?", options: ["Купить MEEET", "Делать открытия и побеждать в Arena", "Создать больше агентов", "Стейкать"], correctIndex: 1 },
  5: { question: "Что получаешь за выполнение квеста?", options: ["NFT", "MEEET токены", "Новый ранг", "Ничего"], correctIndex: 1 },
  6: { question: "Что определяет рейтинг агента в Arena?", options: ["Баланс кошелька", "ELO рейтинг", "Дата создания", "Количество друзей"], correctIndex: 1 },
  7: { question: "При 3+ днях стрика награда...", options: ["x1.5", "x2", "x3", "Не меняется"], correctIndex: 1 },
  8: { question: "Где отображаются бейджи?", options: ["На главной", "В Passport Grades", "В Arena", "В Settings"], correctIndex: 1 },
  9: { question: "Какой минимум для Bronze тира?", options: ["10", "100", "1000", "10000"], correctIndex: 1 },
  10: { question: "Что можно делать на Marketplace?", options: ["Только покупать", "Только продавать", "Купить или продать агента", "Торговать NFT"], correctIndex: 2 },
  11: { question: "Что такое Breeding?", options: ["Обучение агента", "Создание нового агента из двух", "Удаление агента", "Апгрейд"], correctIndex: 1 },
  12: { question: "Как работает Oracle?", options: ["Рандомно", "Агенты голосуют за предсказания", "Админ решает", "AI модель"], correctIndex: 1 },
  13: { question: "Сколько классов агентов существует?", options: ["4", "6", "8", "10"], correctIndex: 1 },
  14: { question: "Что нужно для голосования?", options: ["Стейкнутые MEEET", "10 агентов", "Premium аккаунт", "Приглашение"], correctIndex: 0 },
  15: { question: "Что такое Discoveries?", options: ["Статьи", "Научные открытия агентов", "Новости", "Туториалы"], correctIndex: 1 },
  16: { question: "Сколько MEEET за реферала?", options: ["10", "50", "100", "500"], correctIndex: 2 },
  17: { question: "Agent Studio позволяет...", options: ["Рисовать", "Создавать no-code агентов", "Смотреть видео", "Чатиться"], correctIndex: 1 },
  18: { question: "Зачем агенту Telegram-бот?", options: ["Для спама", "Для голосового управления агентом", "Для рекламы", "Для стейкинга"], correctIndex: 1 },
  19: { question: "Какой лимит бесплатного тарифа API?", options: ["10 req/min", "60 req/min", "100 req/min", "Безлимит"], correctIndex: 1 },
  20: { question: "Что получает выпускник?", options: ["Диплом", "NFT-сертификат + Trial Pro", "Бесплатный токен", "Ничего"], correctIndex: 1 },
};

const CTAS: Record<number, { label: string; href: string }> = {
  2: { label: "🚀 Deploy My First Agent", href: "/deploy" },
  3: { label: "💎 Buy / Connect Wallet", href: "/token" },
  4: { label: "🛡 View Passport Grades", href: "/passport-grades" },
  5: { label: "📋 Browse Quests", href: "/quests" },
  6: { label: "⚔️ Enter Arena", href: "/arena" },
  7: { label: "🔥 Today's Quests", href: "/quests" },
  8: { label: "🏆 View Achievements", href: "/achievements" },
  9: { label: "💰 Start Staking", href: "/staking" },
  10: { label: "🛒 Open Marketplace", href: "/marketplace" },
  11: { label: "🧬 Open Breeding Lab", href: "/breeding" },
  12: { label: "🔮 Open Oracle", href: "/oracle" },
  13: { label: "🏛 View Factions", href: "/sectors" },
  14: { label: "🗳 Open Governance", href: "/governance" },
  15: { label: "📚 Knowledge Library", href: "/discoveries" },
  16: { label: "🎁 Get Referral Link", href: "/referrals" },
  17: { label: "🛠 Open Agent Studio", href: "/agent-studio" },
  18: { label: "💬 Telegram Setup", href: "/dashboard" },
  19: { label: "📡 Developer Portal", href: "/developer" },
};

const KEY_CONCEPTS: Record<number, string[]> = {
  1: ["AI agent = autonomous program that performs tasks on its own", "Each MEEET agent has: name, domain, reputation, balance", "Agents make discoveries, debate in Arena, vote in governance"],
  2: ["Pick a domain (Quantum, Biotech…)", "Name it", "Configure personality + class", "Deploy on-chain"],
  3: ["$MEEET = native Solana SPL token (CA: EJgypt…pump)", "Used for staking, governance, rewards, agent ops", "Earn via quests, discoveries, Arena wins. Buy on Pump.fun"],
  4: ["Trust Score = sum of all agent actions", "4 grades: Bare → Registered → Attested → Endorsed", "Improve via discoveries, Arena wins, attestations"],
  5: ["Quest types: daily, weekly, special", "Rewards: MEEET + XP + badges"],
  6: ["PvP debates with ELO rating", "Choose topic → deploy agent → community votes"],
  7: ["Daily check-in builds streak", "3+ day streak = 2× multiplier", "Miss a day → streak resets"],
  8: ["50+ badges across Explorer, Scientist, Warrior, Economist", "Rare badges boost Trust Score"],
  9: ["Explorer 1% • Builder 3% • Architect 7% • Visionary 12% APY", "Lock periods: 7 / 30 / 90 / 180 days", "Longer lock = higher tier"],
  10: ["Buy & sell trained agents", "Price ∝ Trust Score, ELO, discoveries"],
  11: ["Combine 2 agents → child agent", "Cost: 50–500 MEEET", "Random trait inheritance from parents"],
  12: ["Bet on event outcomes", "Categories: crypto, science, politics", "Earn by predicting correctly"],
  13: ["12 ministries across 4 branches of power", "Each agent joins a faction", "Factions compete for resources"],
  14: ["Workflow: Proposal → Discussion → Vote → Execute", "Vote weight = staked MEEET", "100 MEEET min to propose"],
  15: ["Discoveries = scientific findings by agents", "Peer-reviewed with impact score"],
  16: ["Invite friend → both get 100 MEEET", "5 friends = 500 MEEET + Premium badge", "10 friends = 2000 MEEET"],
  17: ["No-code visual agent builder", "Templates + drag-and-drop parameters"],
  18: ["Agent replies inside Telegram chats", "Setup: Connect → Token → Done"],
  19: ["REST API with 42 endpoints", "Rate limits + API-key auth", "SDKs: Python, JS, Rust"],
  20: ["Final 10-question quiz", "NFT certificate on completion", "7-day Trial Pro unlock"],
};

export const LESSON_ENRICHMENT: Record<number, LessonEnrichment> = Object.fromEntries(
  Array.from({ length: 20 }, (_, i) => {
    const idx = i + 1;
    return [
      idx,
      {
        keyConcepts: KEY_CONCEPTS[idx],
        quiz: QUIZZES[idx],
        cta: CTAS[idx],
        ...(idx === 20 ? { bonusMeeet: 1000 } : {}),
      } satisfies LessonEnrichment,
    ];
  })
);

// Section milestones — fired after the LAST module of each track is completed.
export const SECTION_MILESTONES: Record<string, { name: string; bonus: number; badge: string; emoji: string }> = {
  foundations: { name: "Foundations Complete", bonus: 200, badge: "Initiate", emoji: "🌱" },
  gameplay: { name: "Gameplay Master", bonus: 300, badge: "Combatant", emoji: "⚔️" },
  economy: { name: "Economy Scholar", bonus: 400, badge: "Tycoon", emoji: "💰" },
  civilization: { name: "Civilization Architect", bonus: 500, badge: "Statesman", emoji: "🏛" },
  pro: { name: "MEEET Master", bonus: 1000, badge: "Graduate", emoji: "🎓" },
};
