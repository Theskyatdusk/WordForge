/**
 * Settings Store — Zustand store for user settings.
 * Persisted to localStorage, synced with TTS/SFX utilities.
 */
import { create } from 'zustand';
import type { Settings } from '../types/index';
import { tts } from '../utils/tts';
import { sfx } from '../utils/sfx';

const STORAGE_KEY = 'wordforge_settings';

const defaultSettings: Settings = {
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

function loadStored(): Settings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const data = JSON.parse(raw);
    return { ...defaultSettings, ...data };
  } catch {
    return defaultSettings;
  }
}

function applyToUtilities(settings: Settings): void {
  tts.setEnabled(settings.ttsEnabled);
  tts.setRate(settings.ttsRate);
  tts.setVolume(settings.ttsVolume);
  if (settings.ttsVoice) tts.setVoice(settings.ttsVoice);
  sfx.setEnabled(settings.sfxEnabled, false);

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute(
      'data-theme',
      settings.darkMode ? 'dark' : 'light',
    );
    document.documentElement.setAttribute('data-font-size', settings.fontSize);
    document.documentElement.setAttribute('data-show-pos', String(settings.showPOS));
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,

  loadFromStorage: () => {
    const stored = loadStored();
    set({ settings: stored });
    applyToUtilities(stored);
  },

  saveToStorage: () => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(get().settings));
    } catch {
      // storage unavailable
    }
  },

  update: (partial: Partial<Settings>) => {
    const state = get();
    const newSettings = { ...state.settings, ...partial };
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
