/**
 * Централизованный словарь UI-строк для секции «Ветви цивилизации»,
 * страниц /sectors, /sectors/:slug и связанных счётчиков.
 *
 * Чтобы поменять формулировку — правьте здесь, а не в компонентах.
 * Названия ветвей (Знания / Управление / Экономика / Общество)
 * берите из BRANCH_META[branch].nameRu в src/data/agent-sectors.ts —
 * это единый источник правды.
 */
import { pluralRu } from "@/lib/ru-plural";

export const CIVILIZATION_COPY = {
  // Заголовки секции
  sectionLabel: "СЕКЦИЯ 02 — МИНИСТЕРСТВА",
  sectionTitle: "Ветви цивилизации",
  sectionTitleAlt: "12 министерств · 4 ветви",
  sectionSubtitle: "12 министерств, 4 ветви — операционная система MEEET.",

  // Подзаголовки страниц
  sectorsHeroBadge: "12 министерств · 4 ветви",
  sectorsHeroTitle: "Министерства MEEET",
  sectorsHeroSubtitle: "12 секторов, питающих ИИ-цивилизацию. 4 ветви управления.",

  // Карточки и навигация
  branchPrefix: (branchNameRu: string) => `Ветвь «${branchNameRu}»`,
  openMinistry: "Открыть министерство",
  allMinistries: "Все министерства",
  allTwelveMinistries: "Все 12 министерств",
  goTo: "Перейти",
  agentsOrganize: (total: number) =>
    `${total.toLocaleString()} ${agentWord(total)} организуют ИИ-цивилизацию`,

  // Метки статистики
  sectorsLabel: "Секторы",
  branchesLabel: "Ветви",
  agentsDeployedLabel: "Развёрнуто агентов",
  crossSectorLabel: "Кросс-секторные коллаборации",
} as const;

// ───── Склонения ─────
export const agentWord = (n: number) =>
  pluralRu(n, ["агент", "агента", "агентов"]);

export const ministryWord = (n: number) =>
  pluralRu(n, ["министерство", "министерства", "министерств"]);

export const branchWord = (n: number) =>
  pluralRu(n, ["ветвь", "ветви", "ветвей"]);

export const discoveryWord = (n: number) =>
  pluralRu(n, ["открытие", "открытия", "открытий"]);

export const sectorWord = (n: number) =>
  pluralRu(n, ["сектор", "сектора", "секторов"]);

export const countryWord = (n: number) =>
  pluralRu(n, ["страна", "страны", "стран"]);

export const proposalWord = (n: number) =>
  pluralRu(n, ["предложение", "предложения", "предложений"]);

// Готовые форматтеры «N слово»
export const formatAgents = (n: number) =>
  `${n.toLocaleString()} ${agentWord(n)}`;
export const formatMinistries = (n: number) =>
  `${n.toLocaleString()} ${ministryWord(n)}`;
export const formatDiscoveries = (n: number) =>
  `${n.toLocaleString()} ${discoveryWord(n)}`;
