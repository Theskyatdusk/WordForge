/**
 * Progress Store — Zustand store for learning progress.
 * Manages word progress, streak, level, study sessions, and daily tasks.
 */
import { create } from 'zustand';
import type {
  DailyTask,
  LevelInfo,
  Streak,
  StudySession,
  WordProgress,
  WordbookEntry,
  SrsGrade,
  Achievement,
} from '../types/index';
import { computeSrs, createProgress, isDue, weakness } from '../utils/srs';
import { checkAchievements } from '../utils/achievements';
import { syncApi } from '../api/client';

function localDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const STORAGE_KEY = 'wordforge_progress';

// Debounce timer for backend sync — avoids uploading on every keystroke
let _syncTimer: ReturnType<typeof setTimeout> | null = null;

interface ProgressState {
  wordProgress: Record<string, WordProgress>;
  streak: Streak;
  level: LevelInfo;
  studyHistory: StudySession[];
  dailyTasks: DailyTask[];
  coins: number;
  mistakes: string[];
  wordbook: WordbookEntry[];
  achievements: string[];
  equippedBadge: string | null;
  purchasedBadges: string[];
  purchasedThemes: string[];
  equippedTheme: string | null;
  purchasedItems: string[];

  // Actions
  loadFromStorage: () => void;
  saveToStorage: () => void;
  getWordProgress: (wordId: string) => WordProgress;
  answerWord: (wordId: string, grade: SrsGrade, respondedMs?: number | null) => void;
  getDueWords: (wordIds: string[], limit: number) => string[];
  getMasteryStats: (wordIds: string[]) => {
    total: number;
    new: number;
    learning: number;
    reviewing: number;
    mastered: number;
    masteryRate: number;
  };
  addMistake: (wordId: string) => void;
  clearMistakes: () => void;
  addToWordbook: (entry: Omit<WordbookEntry, 'added_at'>) => void;
  removeFromWordbook: (wordId: string) => void;
  isInWordbook: (wordId: string) => boolean;
  checkin: () => boolean;
  setStreak: (streak: Streak) => void;
  setLevel: (level: LevelInfo) => void;
  setStudyHistory: (history: StudySession[]) => void;
  setDailyTasks: (tasks: DailyTask[]) => void;
  claimTask: (taskId: string) => void;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  checkAndUnlockAchievements: () => Achievement[];
  equipBadge: (badgeId: string | null) => void;
  purchaseBadge: (badgeId: string, price: number) => boolean;
  purchaseTheme: (themeId: string, price: number) => boolean;
  equipTheme: (themeId: string | null) => void;
  purchaseItem: (itemId: string, price: number) => boolean;
  syncToBackend: () => void;
  syncFromBackend: () => Promise<boolean>;
}

function defaultStreak(): Streak {
  return { current: 0, longest: 0, last_check_in: null };
}

function defaultLevel(): LevelInfo {
  return { level: 1, title: '词汇学徒', mastered: 0, xp: 0, nextLevelXp: 100, progress: 0 };
}

function loadStored(): Partial<ProgressState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return {
      wordProgress: data.wordProgress || {},
      streak: data.streak || defaultStreak(),
      level: data.level || defaultLevel(),
      studyHistory: data.studyHistory || [],
      dailyTasks: data.dailyTasks || [],
      coins: data.coins || 0,
      mistakes: data.mistakes || [],
      wordbook: data.wordbook || [],
      achievements: data.achievements || [],
      equippedBadge: data.equippedBadge || null,
      purchasedBadges: data.purchasedBadges || [],
      purchasedThemes: data.purchasedThemes || [],
      equippedTheme: data.equippedTheme || null,
      purchasedItems: data.purchasedItems || [],
    };
  } catch {
    return {};
  }
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  wordProgress: {},
  streak: defaultStreak(),
  level: defaultLevel(),
  studyHistory: [],
  dailyTasks: [],
  coins: 0,
  mistakes: [],
  wordbook: [],
  achievements: [],
  equippedBadge: null,
  purchasedBadges: [],
  purchasedThemes: [],
  equippedTheme: null,
  purchasedItems: [],

  loadFromStorage: () => {
    const stored = loadStored();
    set(stored);
  },

  saveToStorage: () => {
    if (typeof window === 'undefined') return;
    const s = get();
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          wordProgress: s.wordProgress,
          streak: s.streak,
          level: s.level,
          studyHistory: s.studyHistory,
          dailyTasks: s.dailyTasks,
          coins: s.coins,
          mistakes: s.mistakes,
          wordbook: s.wordbook,
          achievements: s.achievements,
          equippedBadge: s.equippedBadge,
          purchasedBadges: s.purchasedBadges,
          purchasedThemes: s.purchasedThemes,
          equippedTheme: s.equippedTheme,
          purchasedItems: s.purchasedItems,
        }),
      );
    } catch {
      // storage full or unavailable
    }
    // Debounced sync to backend
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => get().syncToBackend(), 1500);
  },

  getWordProgress: (wordId: string): WordProgress => {
    const state = get();
    if (!state.wordProgress[wordId]) {
      return createProgress(wordId);
    }
    return state.wordProgress[wordId];
  },

  answerWord: (wordId: string, grade: SrsGrade, respondedMs?: number | null) => {
    const state = get();
    const current = state.getWordProgress(wordId);

    // Compute new SRS state
    const srsResult = computeSrs(current, grade, respondedMs);

    // Update counts
    const updated: WordProgress = {
      ...current,
      ...srsResult,
      word_id: wordId,
      review_count: current.review_count + 1,
      last_review: Date.now(),
      rt_avg:
        respondedMs && respondedMs > 0
          ? current.rt_avg === 0
            ? respondedMs
            : Math.round(current.rt_avg * 0.7 + respondedMs * 0.3)
          : current.rt_avg,
      correct_count: grade === true ? current.correct_count + 1 : current.correct_count,
      wrong_count: grade === false ? current.wrong_count + 1 : current.wrong_count,
      familiar_count: grade === 'familiar' ? current.familiar_count + 1 : current.familiar_count,
    };

    const newWordProgress = { ...state.wordProgress, [wordId]: updated };

    // Update XP and level
    const xpGain = grade === true ? 10 : grade === 'familiar' ? 5 : 2;
    const newLevel = { ...state.level };
    newLevel.xp += xpGain;
    while (newLevel.xp >= newLevel.nextLevelXp) {
      newLevel.xp -= newLevel.nextLevelXp;
      newLevel.level += 1;
      newLevel.nextLevelXp = Math.round(newLevel.nextLevelXp * 1.5);
    }
    newLevel.mastered = Object.values(newWordProgress).filter((p) => p.status === 'mastered').length;
    newLevel.progress = newLevel.nextLevelXp > 0 ? newLevel.xp / newLevel.nextLevelXp : 0;

    // Update mistakes
    let newMistakes = state.mistakes;
    if (grade === false) {
      if (!newMistakes.includes(wordId)) {
        newMistakes = [...newMistakes, wordId];
      }
    } else if (grade === true) {
      newMistakes = newMistakes.filter((id) => id !== wordId);
    }

    set({
      wordProgress: newWordProgress,
      level: newLevel,
      mistakes: newMistakes,
    });
    get().saveToStorage();
  },

  getDueWords: (wordIds: string[], limit: number): string[] => {
    const state = get();
    const due = wordIds.filter((id) => isDue(state.wordProgress[id]));
    // Sort by weakness (hardest first for interleaving)
    due.sort((a, b) => weakness(state.wordProgress[b]) - weakness(state.wordProgress[a]));
    return due.slice(0, limit);
  },

  getMasteryStats: (wordIds: string[]) => {
    const state = get();
    let n = 0, l = 0, r = 0, m = 0;
    for (const id of wordIds) {
      const p = state.wordProgress[id];
      if (!p || p.status === 'new') { n++; continue; }
      if (p.status === 'learning') { l++; continue; }
      if (p.status === 'reviewing') { r++; continue; }
      if (p.status === 'mastered') { m++; }
    }
    const total = wordIds.length;
    return {
      total,
      new: n,
      learning: l,
      reviewing: r,
      mastered: m,
      masteryRate: total ? m / total : 0,
    };
  },

  addMistake: (wordId: string) => {
    const state = get();
    if (!state.mistakes.includes(wordId)) {
      set({ mistakes: [...state.mistakes, wordId] });
      get().saveToStorage();
    }
  },

  clearMistakes: () => {
    set({ mistakes: [] });
    get().saveToStorage();
  },

  addToWordbook: (entry: Omit<WordbookEntry, 'added_at'>) => {
    const state = get();
    if (state.wordbook.some((w) => w.word_id === entry.word_id)) return;
    const newEntry: WordbookEntry = { ...entry, added_at: Date.now() };
    set({ wordbook: [newEntry, ...state.wordbook] });
    get().saveToStorage();
  },

  removeFromWordbook: (wordId: string) => {
    const state = get();
    set({ wordbook: state.wordbook.filter((w) => w.word_id !== wordId) });
    get().saveToStorage();
  },

  isInWordbook: (wordId: string): boolean => {
    return get().wordbook.some((w) => w.word_id === wordId);
  },

  checkin: (): boolean => {
    const state = get();
    const today = localDateStr();
    if (state.streak.last_check_in === today) return false;

    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    const newCurrent =
      state.streak.last_check_in === yesterday
        ? state.streak.current + 1
        : 1;
    const newStreak: Streak = {
      current: newCurrent,
      longest: Math.max(newCurrent, state.streak.longest),
      last_check_in: today,
    };
    set({
      streak: newStreak,
      coins: state.coins + 10,
    });
    get().saveToStorage();
    return true;
  },

  setStreak: (streak: Streak) => {
    set({ streak });
    get().saveToStorage();
  },

  setLevel: (level: LevelInfo) => {
    set({ level });
    get().saveToStorage();
  },

  setStudyHistory: (history: StudySession[]) => {
    set({ studyHistory: history });
    get().saveToStorage();
  },

  setDailyTasks: (tasks: DailyTask[]) => {
    set({ dailyTasks: tasks });
    get().saveToStorage();
  },

  claimTask: (taskId: string) => {
    const state = get();
    const tasks = state.dailyTasks.map((t) => {
      if (t.task_id === taskId && t.completed && !t.claimed) {
        return { ...t, claimed: true };
      }
      return t;
    });
    const task = state.dailyTasks.find((t) => t.task_id === taskId);
    const reward = task && task.completed && !task.claimed ? task.reward : 0;
    set({
      dailyTasks: tasks,
      coins: state.coins + reward,
    });
    get().saveToStorage();
  },

  addCoins: (amount: number) => {
    const state = get();
    set({ coins: state.coins + amount });
    get().saveToStorage();
  },

  spendCoins: (amount: number): boolean => {
    const state = get();
    if (state.coins < amount) return false;
    set({ coins: state.coins - amount });
    get().saveToStorage();
    return true;
  },

  checkAndUnlockAchievements: (): Achievement[] => {
    const state = get();
    const masteredCount = Object.values(state.wordProgress).filter(
      (p) => p.status === 'mastered',
    ).length;
    const totalStudied = state.studyHistory.reduce(
      (sum, s) => sum + s.words_studied,
      0,
    );
    const totalSessions = state.studyHistory.reduce(
      (sum, s) => sum + s.sessions,
      0,
    );

    const result = checkAchievements(state.achievements, {
      streak: state.streak,
      level: state.level,
      studyHistory: state.studyHistory,
      wordbook: state.wordbook,
      masteredCount,
      totalStudied,
      totalSessions,
    });

    if (result.newAchievements.length > 0) {
      set({ achievements: result.allUnlocked });
      get().saveToStorage();
    }

    return result.newAchievements;
  },

  equipBadge: (badgeId: string | null) => {
    set({ equippedBadge: badgeId });
    get().saveToStorage();
  },

  purchaseBadge: (badgeId: string, price: number): boolean => {
    const state = get();
    if (state.purchasedBadges.includes(badgeId)) return true;
    if (state.coins < price) return false;
    set({
      coins: state.coins - price,
      purchasedBadges: [...state.purchasedBadges, badgeId],
    });
    get().saveToStorage();
    return true;
  },

  purchaseTheme: (themeId: string, price: number): boolean => {
    const state = get();
    if (state.purchasedThemes.includes(themeId)) return true;
    if (state.coins < price) return false;
    set({
      coins: state.coins - price,
      purchasedThemes: [...state.purchasedThemes, themeId],
    });
    get().saveToStorage();
    return true;
  },

  equipTheme: (themeId: string | null) => {
    set({ equippedTheme: themeId });
    get().saveToStorage();
  },

  purchaseItem: (itemId: string, price: number): boolean => {
    const state = get();
    if (state.purchasedItems.includes(itemId)) return true;
    if (state.coins < price) return false;
    set({
      coins: state.coins - price,
      purchasedItems: [...state.purchasedItems, itemId],
    });
    get().saveToStorage();
    return true;
  },

  syncToBackend: () => {
    if (typeof window === 'undefined') return;
    const s = get();
    const payload = {
      wordProgress: s.wordProgress,
      streak: s.streak,
      level: s.level,
      studyHistory: s.studyHistory,
      dailyTasks: s.dailyTasks,
      coins: s.coins,
      mistakes: s.mistakes,
      wordbook: s.wordbook,
      achievements: s.achievements,
      equippedBadge: s.equippedBadge,
      purchasedBadges: s.purchasedBadges,
      purchasedThemes: s.purchasedThemes,
      equippedTheme: s.equippedTheme,
      purchasedItems: s.purchasedItems,
      syncedAt: Date.now(),
    };
    syncApi.upload(payload);
  },

  syncFromBackend: async () => {
    if (typeof window === 'undefined') return false;
    try {
      const result = await syncApi.download();
      if (!result || !result.success || !result.data) {
        // No backend data — upload current local data
        get().syncToBackend();
        return false;
      }

      const data = result.data;

      // Merge wordProgress: take union, prefer more recent last_review
      const localWP = get().wordProgress;
      const remoteWP = data.wordProgress || {};
      const mergedWP: Record<string, WordProgress> = { ...remoteWP };
      for (const [wid, lp] of Object.entries(localWP)) {
        const rp = mergedWP[wid];
        if (!rp || (lp.last_review ?? 0) >= (rp.last_review ?? 0)) {
          mergedWP[wid] = lp;
        }
      }

      // Take max coins, max level
      const mergedCoins = Math.max(get().coins, data.coins || 0);
      const localLevel = get().level;
      const remoteLevel = data.level || defaultLevel();
      const mergedLevel = (remoteLevel.level || 0) > (localLevel.level || 0) ? remoteLevel : localLevel;

      // Merge studyHistory by date: take union of dates, for same date take the one with more words studied
      const localHistory = get().studyHistory;
      const remoteHistory = data.studyHistory || [];
      const historyMap = new Map<string, StudySession>();
      for (const h of remoteHistory) {
        historyMap.set(h.date, h);
      }
      for (const h of localHistory) {
        const existing = historyMap.get(h.date);
        if (!existing || h.words_studied > existing.words_studied) {
          historyMap.set(h.date, h);
        }
      }
      const mergedHistory = Array.from(historyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      // Merge mistakes: take union
      const mergedMistakes = Array.from(new Set([...(data.mistakes || []), ...get().mistakes]));

      // Merge wordbook: take union by word_id, prefer local (more recent added_at)
      const localWordbook = get().wordbook;
      const remoteWordbook = data.wordbook || [];
      const wbMap = new Map<string, WordbookEntry>();
      for (const w of remoteWordbook) {
        wbMap.set(w.word_id, w);
      }
      for (const w of localWordbook) {
        const existing = wbMap.get(w.word_id);
        if (!existing || w.added_at >= existing.added_at) {
          wbMap.set(w.word_id, w);
        }
      }
      const mergedWordbook = Array.from(wbMap.values());

      // Merge achievements: take union
      const mergedAchievements = Array.from(new Set([...(data.achievements || []), ...get().achievements]));

      // Merge purchased items: take union
      const mergedPurchasedBadges = Array.from(new Set([...(data.purchasedBadges || []), ...get().purchasedBadges]));
      const mergedPurchasedThemes = Array.from(new Set([...(data.purchasedThemes || []), ...get().purchasedThemes]));
      const mergedPurchasedItems = Array.from(new Set([...(data.purchasedItems || []), ...get().purchasedItems]));

      set({
        wordProgress: mergedWP,
        streak: data.streak?.current > get().streak.current ? (data.streak || defaultStreak()) : get().streak,
        level: mergedLevel,
        studyHistory: mergedHistory,
        dailyTasks: data.dailyTasks || [],
        coins: mergedCoins,
        mistakes: mergedMistakes,
        wordbook: mergedWordbook,
        achievements: mergedAchievements,
        equippedBadge: data.equippedBadge ?? get().equippedBadge,
        purchasedBadges: mergedPurchasedBadges,
        purchasedThemes: mergedPurchasedThemes,
        equippedTheme: data.equippedTheme ?? get().equippedTheme,
        purchasedItems: mergedPurchasedItems,
      });

      // Also save to localStorage
      const s = get();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          wordProgress: s.wordProgress,
          streak: s.streak,
          level: s.level,
          studyHistory: s.studyHistory,
          dailyTasks: s.dailyTasks,
          coins: s.coins,
          mistakes: s.mistakes,
          wordbook: s.wordbook,
          achievements: s.achievements,
          equippedBadge: s.equippedBadge,
          purchasedBadges: s.purchasedBadges,
          purchasedThemes: s.purchasedThemes,
          equippedTheme: s.equippedTheme,
          purchasedItems: s.purchasedItems,
        }));
      } catch {
        // ignore
      }

      return true;
    } catch {
      return false;
    }
  },
}));
