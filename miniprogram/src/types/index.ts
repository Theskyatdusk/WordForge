/**
 * TypeScript type definitions for WordForge data models
 */

export interface Item {
  id: number;
  en: string;
  zh: string;
  pos?: string;
}

export interface Group {
  id: number;
  title: string;
  type: 'word' | 'phrase' | 'sentence';
  items: Item[];
}

export interface Section {
  id: string;
  title: string;
  groups: Group[];
}

export interface Chapter {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  color?: string;
  sections: Section[];
}

export interface VocabData {
  chapters: Chapter[];
}

export type WordStatus = 'new' | 'learning' | 'reviewing' | 'mastered';

export interface WordProgress {
  word_id: string;
  status: WordStatus;
  review_count: number;
  correct_count: number;
  wrong_count: number;
  familiar_count: number;
  last_review: number | null;
  next_review: number | null;
  ease: number;
  interval: number;
  repetitions: number;
  rt_avg: number;
}

export interface WordbookEntry {
  word_id: string;
  en: string;
  zh: string;
  pos?: string;
  chapter_id: string;
  added_at: number;
}

export interface StudySession {
  date: string;
  words_studied: number;
  correct: number;
  wrong: number;
  sessions: number;
  modes: Record<string, number>;
}

export interface Settings {
  dailyGoal: number;
  dailyNewGoal: number;
  studyMode: string;
  darkMode: boolean;
  ttsEnabled: boolean;
  ttsRate: number;
  ttsVolume: number;
  ttsAutoPlay: boolean;
  ttsVoice: string | null;
  sfxEnabled: boolean;
  focusMode: boolean;
  feedbackLevel: 'strong' | 'medium' | 'weak';
  showRewards: boolean;
  examplesOnCard: boolean;
  recallFirst: boolean;
  repeatCorrect: number;
  quizOptionCount: 4 | 6;
  autoAdvance: boolean;
  autoAdvanceDelay: number;
  fontSize: 'small' | 'medium' | 'large';
  cardAutoFlip: boolean;
  cardAutoFlipDelay: number;
  showPOS: boolean;
}

export interface Streak {
  current: number;
  longest: number;
  last_check_in: string | null;
}

export interface LevelInfo {
  level: number;
  title: string;
  mastered: number;
  xp: number;
  nextLevelXp: number;
  progress: number;
}

export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  price: number;
}

export interface DailyTask {
  date: string;
  task_id: string;
  completed: boolean;
  claimed: boolean;
  reward: number;
  title: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** SM-2 grade type: true = known, 'familiar' = vague, false = unknown */
export type SrsGrade = true | 'familiar' | false;

/** Result of an SRS calculation — used for immediate UI feedback */
export interface SrsResult {
  ease: number;
  interval: number;
  repetitions: number;
  next_review: number;
  status: WordStatus;
}

/** Example sentence tiers */
export interface ExampleSentence {
  tier: number;
  label: string;
  en: string;
  zh: string;
  tag: string;
}

/** Confusable word question */
export interface ConfuseQuestion {
  zh: string;
  pos: string;
  answer: string;
  options: Array<{ en: string; zh: string; correct: boolean; sim: number }>;
  topSim: number;
}

/** Achievement definition */
export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
}

/** Badge Definition (shop purchasable + equippable) */
export interface Badge {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  price: number;
}

/** Shadow (speech recognition) result */
export interface ShadowResult {
  heard?: string;
  score?: number;
  error?: string;
}
