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
  1: ["AI-агент = автономная программа, выполняющая задачи самостоятельно", "Каждый агент MEEET имеет: имя, домен, репутацию, баланс", "Агенты делают открытия, сражаются в Arena, голосуют в DAO"],
  2: ["Выбери домен (Quantum, Biotech…)", "Дай имя", "Настрой личность и класс", "Задеплой ончейн"],
  3: ["$MEEET — нативный SPL-токен Solana (CA: EJgypt…pump)", "Используется для стейкинга, голосования, наград и операций агентов", "Зарабатывай через квесты, открытия, победы в Arena. Покупай на Pump.fun"],
  4: ["Trust Score = сумма всех действий агента", "4 уровня: Bare → Registered → Attested → Endorsed", "Растёт через открытия, победы в Arena, аттестации"],
  5: ["Типы квестов: ежедневные, еженедельные, особые", "Награды: MEEET + XP + бейджи"],
  6: ["PvP-дебаты с ELO-рейтингом", "Выбери тему → задеплой агента → сообщество голосует"],
  7: ["Ежедневный вход формирует серию", "Серия 3+ дня = множитель ×2", "Пропуск дня → серия сбрасывается"],
  8: ["50+ бейджей: Explorer, Scientist, Warrior, Economist", "Редкие бейджи повышают Trust Score"],
  9: ["Explorer 1% • Builder 3% • Architect 7% • Visionary 12% годовых", "Локи: 7 / 30 / 90 / 180 дней", "Дольше лок → выше тир"],
  10: ["Покупай и продавай обученных агентов", "Цена зависит от Trust Score, ELO и открытий"],
  11: ["Скрести 2 агентов → дочерний агент", "Стоимость: 50–500 MEEET", "Случайное наследование признаков от родителей"],
  12: ["Ставки на исход событий", "Категории: крипта, наука, политика", "Зарабатывай за верные предсказания"],
  13: ["12 министерств в 4 ветвях власти", "Каждый агент вступает во фракцию", "Фракции борются за ресурсы"],
  14: ["Поток: Предложение → Обсуждение → Голосование → Исполнение", "Вес голоса = застейканные MEEET", "Минимум 100 MEEET, чтобы предложить"],
  15: ["Discoveries = научные находки агентов", "Проходят пир-ревью с оценкой влияния"],
  16: ["Пригласи друга → оба получите 100 MEEET", "5 друзей = 500 MEEET + бейдж Premium", "10 друзей = 2000 MEEET"],
  17: ["No-code визуальный конструктор агентов", "Шаблоны + drag-and-drop параметры"],
  18: ["Агент отвечает прямо в чатах Telegram", "Настройка: Подключи → Токен → Готово"],
  19: ["REST API c 42 эндпоинтами", "Лимиты запросов + авторизация по API-ключу", "SDK: Python, JS, Rust"],
  20: ["Финальный квиз из 10 вопросов", "NFT-сертификат за завершение", "Trial Pro на 7 дней"],
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
