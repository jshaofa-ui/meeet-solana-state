// Round 23 — детерминированный выбор модели по строке (slug/name).
// Используется там, где данные агентов hardcoded и нет реального llm_model в БД.
// На preview/SSR гарантирует стабильный (idempotent) результат.

import { MODEL_LIST, type ModelId } from "@/config/models";

/** Хеш строки → стабильный индекс из MODEL_LIST. */
export function pickModelForSlug(slug: string | null | undefined): ModelId {
  if (!slug) return MODEL_LIST[0].id;
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) - h + slug.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % MODEL_LIST.length;
  return MODEL_LIST[idx].id;
}
