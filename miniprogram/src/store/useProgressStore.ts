/**
 * Progress Store —— 对齐 web 端 frontend/src/store/useProgressStore.ts。
 * 差异：localStorage → Taro 同步存储（utils/storage）。
 */
import { create } from 'zustand';
import type {
  Achievement,
  DailyTask,
  LevelInfo,
  SrsGrade,
  Streak,
  StudySession,
  WordProgress,
  WordbookEntry,
} from '../types/index';
import { computeSrs, createProgress, isDue, weakness } from '../utils/srs';
import { checkAchievements } from '../utils/achievements';
import { syncApi } from '../api/client';
import { storage } from '../utils/storage';

const STORAGE_KEY = 'wordforge_progress';

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
  recordStudy: (correct: number, wrong: number, mode: string) => void;
  syncToBackend: () => void;
  syncFromBackend: () => Promise<boolean>;
}

function defaultStreak(): Streak {
  return { current: 0, longest: 0, last_check_in: null };
}

function defaultLevel(): LevelInfo {
  return { level: 1, title: '词汇学徒', mastered: 0, xp: 0, nextLevelXp: 100, progress: 0 };
}

/** 需要持久化的字段 —— 单点定义，避免 save/sync 两处漏字段 */
function pickPersisted(s: ProgressState) {
  return {
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
  };
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

  loadFromStorage: () => {
    const data = storage.get<any>(STORAGE_KEY, null);
    if (!data) return;
    set({
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
    });
  },

  saveToStorage: () => {
    storage.set(STORAGE_KEY, pickPersisted(get()));
    // 防抖同步到后端，避免每次答题都上传
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => get().syncToBackend(), 1500);
  },

  getWordProgress: (wordId: string): WordProgress => {
    const state = get();
    return state.wordProgress[wordId] || createProgress(wordId);
  },

  answerWord: (wordId: string, grade: SrsGrade, respondedMs?: number | null) => {
    const state = get();
    const current = state.getWordProgress(wordId);
    const srsResult = computeSrs(current, grade, respondedMs);

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

    // XP / 等级
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

    // 错题本
    let newMistakes = state.mistakes;
    if (grade === false) {
      if (!newMistakes.includes(wordId)) newMistakes = [...newMistakes, wordId];
    } else if (grade === true) {
      newMistakes = newMistakes.filter((id) => id !== wordId);
    }

    set({ wordProgress: newWordProgress, level: newLevel, mistakes: newMistakes });
    get().saveToStorage();
  },

  getDueWords: (wordIds: string[], limit: number): string[] => {
    const state = get();
    const due = wordIds.filter((id) => isDue(state.wordProgress[id]));
    due.sort((a, b) => weakness(state.wordProgress[b]) - weakness(state.wordProgress[a]));
    return due.slice(0, limit);
  },

  getMasteryStats: (wordIds: string[]) => {
    const state = get();
    let n = 0;
    let l = 0;
    let r = 0;
    let m = 0;
    for (const id of wordIds) {
      const p = state.wordProgress[id];
      if (!p || p.status === 'new') { n++; continue; }
      if (p.status === 'learning') { l++; continue; }
      if (p.status === 'reviewing') { r++; continue; }
      if (p.status === 'mastered') { m++; }
    }
    const total = wordIds.length;
    return { total, new: n, learning: l, reviewing: r, mastered: m, masteryRate: total ? m / total : 0 };
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

  isInWordbook: (wordId: string): boolean => get().wordbook.some((w) => w.word_id === wordId),

  checkin: (): boolean => {
    const state = get();
    const today = new Date().toISOString().slice(0, 10);
    if (state.streak.last_check_in === today) return false;

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newCurrent = state.streak.last_check_in === yesterday ? state.streak.current + 1 : 1;
    set({
      streak: {
        current: newCurrent,
        longest: Math.max(newCurrent, state.streak.longest),
        last_check_in: today,
      },
      coins: state.coins + 10,
    });
    get().saveToStorage();
    return true;
  },

  setStreak: (streak: Streak) => { set({ streak }); get().saveToStorage(); },
  setLevel: (level: LevelInfo) => { set({ level }); get().saveToStorage(); },
  setStudyHistory: (history: StudySession[]) => { set({ studyHistory: history }); get().saveToStorage(); },
  setDailyTasks: (tasks: DailyTask[]) => { set({ dailyTasks: tasks }); get().saveToStorage(); },

  claimTask: (taskId: string) => {
    const state = get();
    const task = state.dailyTasks.find((t) => t.task_id === taskId);
    const reward = task && task.completed && !task.claimed ? task.reward : 0;
    set({
      dailyTasks: state.dailyTasks.map((t) =>
        t.task_id === taskId && t.completed && !t.claimed ? { ...t, claimed: true } : t,
      ),
      coins: state.coins + reward,
    });
    get().saveToStorage();
  },

  addCoins: (amount: number) => { set({ coins: get().coins + amount }); get().saveToStorage(); },

  spendCoins: (amount: number): boolean => {
    const state = get();
    if (state.coins < amount) return false;
    set({ coins: state.coins - amount });
    get().saveToStorage();
    return true;
  },

  checkAndUnlockAchievements: (): Achievement[] => {
    const state = get();
    const masteredCount = Object.values(state.wordProgress).filter((p) => p.status === 'mastered').length;
    const totalStudied = state.studyHistory.reduce((sum, s) => sum + s.words_studied, 0);
    const totalSessions = state.studyHistory.reduce((sum, s) => sum + s.sessions, 0);

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

  equipBadge: (badgeId: string | null) => { set({ equippedBadge: badgeId }); get().saveToStorage(); },

  purchaseBadge: (badgeId: string, price: number): boolean => {
    const state = get();
    if (state.purchasedBadges.includes(badgeId)) return true;
    if (state.coins < price) return false;
    set({ coins: state.coins - price, purchasedBadges: [...state.purchasedBadges, badgeId] });
    get().saveToStorage();
    return true;
  },

  purchaseTheme: (themeId: string, price: number): boolean => {
    const state = get();
    if (state.purchasedThemes.includes(themeId)) return true;
    if (state.coins < price) return false;
    set({ coins: state.coins - price, purchasedThemes: [...state.purchasedThemes, themeId] });
    get().saveToStorage();
    return true;
  },

  equipTheme: (themeId: string | null) => { set({ equippedTheme: themeId }); get().saveToStorage(); },

  /** 累加今日学习记录（供 Study 页收尾调用） */
  recordStudy: (correct: number, wrong: number, mode: string) => {
    const state = get();
    const today = new Date().toISOString().slice(0, 10);
    const history = [...state.studyHistory];
    const idx = history.findIndex((s) => s.date === today);
    if (idx >= 0) {
      const prev = history[idx];
      history[idx] = {
        ...prev,
        words_studied: prev.words_studied + correct + wrong,
        correct: prev.correct + correct,
        wrong: prev.wrong + wrong,
        sessions: prev.sessions + 1,
        modes: { ...prev.modes, [mode]: (prev.modes?.[mode] || 0) + 1 },
      };
    } else {
      history.push({
        date: today,
        words_studied: correct + wrong,
        correct,
        wrong,
        sessions: 1,
        modes: { [mode]: 1 },
      });
    }
    set({ studyHistory: history });
    get().saveToStorage();
  },

  syncToBackend: () => {
    syncApi.upload({ ...pickPersisted(get()), syncedAt: Date.now() });
  },

  syncFromBackend: async () => {
    try {
      const result = await syncApi.download();
      if (!result || !result.success || !result.data) {
        get().syncToBackend();
        return false;
      }
      const data = result.data;

      // 本地进度更多则保留本地并回传
      const localWords = Object.keys(get().wordProgress).length;
      const remoteWords = data.wordProgress ? Object.keys(data.wordProgress).length : 0;
      if (
        localWords > remoteWords &&
        get().coins >= (data.coins || 0) &&
        (get().level?.level || 0) >= (data.level?.level || 0)
      ) {
        get().syncToBackend();
        return false;
      }

      set({
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
      });
      storage.set(STORAGE_KEY, pickPersisted(get()));
      return true;
    } catch {
      return false;
    }
  },
}));
