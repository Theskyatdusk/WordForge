/**
 * SM-2 Spaced Repetition Algorithm — client-side for immediate UI feedback.
 * Mirrors the backend scheduling logic so the UI can preview the next review
 * date without a round-trip.
 *
 * Tuned for exam-prep scenarios (converged ease bounds, capped interval).
 */
import type { SrsGrade, SrsResult, WordProgress, WordStatus } from '../types/index';

// ===== SM-2 tuning constants (exam-prep converged) =====
export const EASE_MIN = 1.3;
export const EASE_MAX = 2.8;
export const INTERVAL_MAX = 180; // days — must see word again within exam cycle
export const MATURE_INTERVAL = 21; // days — mastery threshold

const DAY_MS = 86400000;

/**
 * Compute the next SRS state for a word given the current progress and grade.
 * Pure function — does not mutate the input. Returns the projected next state.
 */
export function computeSrs(
  progress: Pick<
    WordProgress,
    'ease' | 'interval' | 'repetitions' | 'status' | 'rt_avg'
  >,
  grade: SrsGrade,
  respondedMs?: number | null,
): SrsResult {
  let ease = typeof progress.ease === 'number' ? progress.ease : 2.5;
  let interval = typeof progress.interval === 'number' ? progress.interval : 0;
  let repetitions =
    typeof progress.repetitions === 'number' ? progress.repetitions : 0;

  // Map grade -> SM-2 quality score (0-5)
  let q: number = grade === true ? 5 : grade === 'familiar' ? 3 : 1;

  // Reaction-time awareness: hesitation > 3s downgrades; fast < 0.8s gives ease bonus
  if (typeof respondedMs === 'number' && respondedMs > 0) {
    if (respondedMs > 3000 && q >= 3) {
      q = 3;
    } else if (respondedMs < 800 && q >= 3) {
      ease = Math.min(EASE_MAX, ease + 0.05);
    }
  }

  // Update repetition count + interval
  if (q >= 3) {
    // Successful recall
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * ease);
    repetitions += 1;
  } else {
    // Failed recall: reset and relearn tomorrow
    repetitions = 0;
    interval = 1;
  }

  // Update easiness factor (bounded)
  ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ease < EASE_MIN) ease = EASE_MIN;
  if (ease > EASE_MAX) ease = EASE_MAX;

  // Cap interval for exam-prep cycle
  if (interval > INTERVAL_MAX) interval = INTERVAL_MAX;

  const next_review = Date.now() + interval * DAY_MS;

  // Status flow (drives UI progress buckets)
  const status = computeStatus(progress.status, grade, interval, repetitions);

  return { ease, interval, repetitions, next_review, status };
}

function computeStatus(
  currentStatus: WordStatus,
  grade: SrsGrade,
  interval: number,
  repetitions: number,
): WordStatus {
  if (grade === true) {
    if (currentStatus === 'new') return 'learning';
    if (currentStatus === 'learning') return 'reviewing';
    if (currentStatus === 'reviewing' && interval >= MATURE_INTERVAL)
      return 'mastered';
    return currentStatus === 'mastered' ? 'mastered' : currentStatus;
  } else if (grade === 'familiar') {
    if (currentStatus === 'new') return 'learning';
    if (currentStatus === 'mastered') return 'reviewing';
    if (currentStatus === 'learning' && repetitions >= 2) return 'reviewing';
    return currentStatus;
  } else {
    return 'learning';
  }
}

/**
 * Create a fresh WordProgress object for a new word.
 */
export function createProgress(wordId: string): WordProgress {
  return {
    word_id: wordId,
    status: 'new',
    review_count: 0,
    correct_count: 0,
    wrong_count: 0,
    familiar_count: 0,
    last_review: null,
    next_review: null,
    ease: 2.5,
    interval: 0,
    repetitions: 0,
    rt_avg: 0,
  };
}

/**
 * Check whether a word is "due" for review at the given timestamp.
 */
export function isDue(progress: WordProgress | undefined, now = Date.now()): boolean {
  if (!progress) return true;
  if (progress.status === 'new') return true;
  if (progress.next_review === null) return true;
  return progress.next_review <= now;
}

/**
 * Compute a "weakness" score 0-1 for interleaving purposes.
 * Higher = weaker (more wrong, lower ease, longer since last review).
 */
export function weakness(progress: WordProgress | undefined): number {
  if (!progress) return 0.5;
  const wrongRate =
    progress.review_count > 0
      ? progress.wrong_count / progress.review_count
      : 0;
  const easeFactor = (EASE_MAX - progress.ease) / (EASE_MAX - EASE_MIN);
  const staleness =
    progress.last_review !== null
      ? Math.min(1, (Date.now() - progress.last_review) / (30 * DAY_MS))
      : 0.5;
  return Math.min(1, wrongRate * 0.4 + easeFactor * 0.3 + staleness * 0.3);
}

// ===== Memory Strength & Box (for memory strength bar visualization) =====
export const STRENGTH_WEAK = 40;

/**
 * Compute memory strength 0-100 based on SRS state.
 * Combines ease, repetitions, interval, and correctness.
 */
export function getStrength(progress: WordProgress | undefined): number {
  if (!progress || progress.review_count === 0) return 0;
  const easeScore = ((progress.ease - EASE_MIN) / (EASE_MAX - EASE_MIN)) * 40;
  const repScore = Math.min(30, progress.repetitions * 6);
  const intervalScore = Math.min(20, (progress.interval / INTERVAL_MAX) * 20);
  const correctRate =
    progress.review_count > 0
      ? progress.correct_count / progress.review_count
      : 0;
  const correctScore = correctRate * 10;
  return Math.round(Math.max(0, Math.min(100, easeScore + repScore + intervalScore + correctScore)));
}

/**
 * Compute the "box" (Leitner box) 1-5 based on repetitions and interval.
 */
export function getBox(progress: WordProgress | undefined): number {
  if (!progress || progress.repetitions === 0) return 1;
  if (progress.interval >= MATURE_INTERVAL) return 5;
  if (progress.interval >= 14) return 4;
  if (progress.interval >= 6) return 3;
  if (progress.repetitions >= 2) return 2;
  return 1;
}
