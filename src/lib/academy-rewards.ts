// LocalStorage-backed Academy monetization layer.
// Tracks: balance, streak, certifications, mastery unlock, referral.

const K = {
  balance: "meeet_academy_balance",
  lastDate: "meeet_last_lesson_date",
  streak: "meeet_streak_count",
  certFoundations: "meeet_certified_foundations",
  masteryUnlocked: "meeet_mastery_unlocked",
  refId: "meeet_ref_id",
  refCount: "meeet_referral_count",
  rewardedSlugs: "meeet_rewarded_slugs",
} as const;

export const FOUNDATIONS_CERT_COST = 500;
export const MASTERY_UNLOCK_COST = 2000;
export const REFERRAL_REWARD = 100;

export function getBalance(): number {
  return Number(localStorage.getItem(K.balance) || "0");
}
export function setBalance(v: number) {
  localStorage.setItem(K.balance, String(Math.max(0, Math.floor(v))));
}
export function addBalance(delta: number): number {
  const next = getBalance() + delta;
  setBalance(next);
  return next;
}

export function getStreak(): number {
  return Number(localStorage.getItem(K.streak) || "0");
}

/** Compute streak based on today vs last completion date. Updates streak + lastDate. Returns new streak. */
export function bumpStreak(): number {
  const today = new Date().toISOString().slice(0, 10);
  const last = localStorage.getItem(K.lastDate);
  let streak = getStreak();
  if (last === today) {
    // Already counted today
    return streak;
  }
  if (last) {
    const lastDate = new Date(last + "T00:00:00");
    const todayDate = new Date(today + "T00:00:00");
    const diff = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000);
    if (diff === 1) streak += 1;
    else streak = 1; // missed → reset
  } else {
    streak = 1;
  }
  localStorage.setItem(K.streak, String(streak));
  localStorage.setItem(K.lastDate, today);
  return streak;
}

/** Compute reward for a given lesson order (1-based). Doubles if streak >=3. */
export function lessonReward(order: number, streak: number): { base: number; final: number; doubled: boolean } {
  let base = 10;
  if (order >= 9 && order <= 14) base = 25;
  else if (order >= 15) base = 50;
  const doubled = streak >= 3;
  return { base, final: doubled ? base * 2 : base, doubled };
}

export function hasRewarded(slug: string): boolean {
  try {
    const arr: string[] = JSON.parse(localStorage.getItem(K.rewardedSlugs) || "[]");
    return arr.includes(slug);
  } catch { return false; }
}
export function markRewarded(slug: string) {
  try {
    const arr: string[] = JSON.parse(localStorage.getItem(K.rewardedSlugs) || "[]");
    if (!arr.includes(slug)) {
      arr.push(slug);
      localStorage.setItem(K.rewardedSlugs, JSON.stringify(arr));
    }
  } catch {
    localStorage.setItem(K.rewardedSlugs, JSON.stringify([slug]));
  }
}

export function isFoundationsCertified(): boolean {
  return localStorage.getItem(K.certFoundations) === "1";
}
export function setFoundationsCertified() {
  localStorage.setItem(K.certFoundations, "1");
}

export function isMasteryUnlocked(): boolean {
  return localStorage.getItem(K.masteryUnlocked) === "1";
}
export function setMasteryUnlocked() {
  localStorage.setItem(K.masteryUnlocked, "1");
}

export function getOrCreateRefId(): string {
  let id = localStorage.getItem(K.refId);
  if (!id) {
    id = Math.random().toString(36).slice(2, 8).toUpperCase();
    localStorage.setItem(K.refId, id);
  }
  return id;
}
export function getReferralCount(): number {
  return Number(localStorage.getItem(K.refCount) || "0");
}
