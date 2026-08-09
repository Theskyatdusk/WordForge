/**
 * Settings Store —— 对齐 web 端 frontend/src/store/useSettingsStore.ts。
 * 差异：
 *   - localStorage → Taro 同步存储
 *   - document.documentElement[data-*] → 由 useThemeClass() 生成根 View 的 className
 */
import { create } from 'zustand';
import type { Settings } from '../types/index';
import { tts } from '../utils/tts';
import { sfx } from '../utils/sfx';
import { storage } from '../utils/storage';

const STORAGE_KEY = 'wordforge_settings';

export const defaultSettings: Settings = {
  dailyGoal: 20,
  dailyNewGoal: 10,
  studyMode: 'flashcard',
  darkMode: false,
  ttsEnabled: true,
  ttsRate: 0.9,
  ttsVolume: 1,
  ttsAutoPlay: true,
  ttsVoice: null,
  sfxEnabled: true,
  focusMode: false,
  feedbackLevel: 'medium',
  showRewards: true,
  examplesOnCard: true,
  recallFirst: false,
  repeatCorrect: 2,
  quizOptionCount: 4,
  autoAdvance: false,
  autoAdvanceDelay: 1.5,
  fontSize: 'medium',
  cardAutoFlip: false,
  cardAutoFlipDelay: 3,
  showPOS: true,
};

interface SettingsState {
  settings: Settings;
  loadFromStorage: () => void;
  saveToStorage: () => void;
  update: (partial: Partial<Settings>) => void;
  reset: () => void;
}

function applyToUtilities(settings: Settings): void {
  tts.setEnabled(settings.ttsEnabled);
  tts.setRate(settings.ttsRate);
  tts.setVolume(settings.ttsVolume);
  if (settings.ttsVoice) tts.setVoice(settings.ttsVoice);
  sfx.setEnabled(settings.sfxEnabled);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,

  loadFromStorage: () => {
    const stored = storage.get<Partial<Settings>>(STORAGE_KEY, undefined);
    const merged = { ...defaultSettings, ...(stored || {}) };
    set({ settings: merged });
    applyToUtilities(merged);
  },

  saveToStorage: () => {
    storage.set(STORAGE_KEY, get().settings);
  },

  update: (partial: Partial<Settings>) => {
    const newSettings = { ...get().settings, ...partial };
    set({ settings: newSettings });
    applyToUtilities(newSettings);
    get().saveToStorage();
  },

  reset: () => {
    set({ settings: defaultSettings });
    applyToUtilities(defaultSettings);
    get().saveToStorage();
  },
}));

/** 字号档位 → 根 View 的类名（对应 app.scss 里的 .fs-* 规则） */
export function fontSizeClass(size: Settings['fontSize']): string {
  return `fs-${size}`;
}
