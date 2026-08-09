/**
 * Confuse Module — Confusable word detection (auto-constructed look-alike pairs).
 *
 * Instead of a hand-maintained confusable table, this module automatically
 * constructs form-similar word pairs from the current vocabulary set,
 * so it works with user-imported custom word lists too.
 *
 * Similarity = normalized Levenshtein distance baseline
 * + first-letter / length-diff / common-prefix / common-suffix weighting.
 *
 * Pure client-side, zero dependencies. Results cached per wordId (LRU).
 */
import type { ConfuseQuestion, Item } from '../types/index';

const MIN_SIM = 0.45;
const MAX_TOKENS = 3;
const MIN_DISTRACTORS = 2;
const MAX_CACHE = 500;

interface ScoredItem {
  item: Item;
  sim: number;
}

interface CachedQuestion {
  zh: string;
  pos: string;
  answer: string;
  topSim: number;
  options: Array<{ en: string; zh: string; correct: boolean; sim: number }>;
}

interface QuestionOption {
  en: string;
  zh: string;
  correct: boolean;
  sim: number;
}

interface InternalQuestion {
  zh: string;
  pos: string;
  answer: string;
  topSim: number;
  options: QuestionOption[];
}

let _cache: Record<string, CachedQuestion | null> = {};
let _cacheKeys: string[] = [];
let _pool: (Item & { __size?: number })[] | null = null;
let _poolSig = '';

function _norm(s: string | null | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _tokens(s: string): number {
  const n = _norm(s);
  return n ? n.split(' ').length : 0;
}

/** Levenshtein edit distance (rolling array, O(min(m,n)) space) */
export function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a || !a.length) return b ? b.length : 0;
  if (!b || !b.length) return a.length;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1);
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Form similarity 0-1 */
export function similarity(a: string, b: string): number {
  const x = _norm(a);
  const y = _norm(b);
  if (!x || !y || x === y) return 0;
  const maxLen = Math.max(x.length, y.length);
  let score = 1 - lev(x, y) / maxLen;
  if (x[0] === y[0]) score += 0.08;
  if (Math.abs(x.length - y.length) <= 2) score += 0.05;
  let cp = 0;
  while (cp < x.length && cp < y.length && x[cp] === y[cp]) cp++;
  score += Math.min(0.15, (cp / maxLen) * 0.3);
  let cs = 0;
  while (
    cs < x.length &&
    cs < y.length &&
    x[x.length - 1 - cs] === y[y.length - 1 - cs]
  )
    cs++;
  score += Math.min(0.1, (cs / maxLen) * 0.2);
  return Math.max(0, Math.min(1, score));
}

function _buildPool(allWords: Item[]): Item[] {
  const size = allWords ? allWords.length : 0;
  const first = (allWords && allWords[0] && allWords[0].en) || '';
  const last = (allWords && allWords[size - 1] && allWords[size - 1].en) || '';
  const sig = size + ':' + first + ':' + last;
  if (_pool && _poolSig === sig) return _pool as Item[];
  const pool = (allWords || []).filter(
    (w) => w && w.en && w.zh && _tokens(w.en) <= MAX_TOKENS,
  );
  _pool = pool;
  _poolSig = sig;
  _cache = {};
  _cacheKeys = [];
  return pool;
}

/** Find the n most similar words to the target (sorted by similarity desc) */
export function findConfusables(
  target: Item,
  allWords: Item[],
  n = 3,
): ScoredItem[] {
  if (!target || !target.en) return [];
  const pool = _buildPool(allWords);
  const tTok = _tokens(target.en);
  if (tTok === 0 || tTok > MAX_TOKENS) return [];
  const scored: ScoredItem[] = [];
  for (let i = 0; i < pool.length; i++) {
    const w = pool[i];
    if (w.en === target.en) continue;
    if (_tokens(w.en) !== tTok) continue;
    const s = similarity(target.en, w.en);
    if (s >= MIN_SIM) scored.push({ item: w, sim: s });
  }
  scored.sort((a, b) => b.sim - a.sim);
  return scored.slice(0, n);
}

function _shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function _buildQuestion(target: Item, allWords: Item[]): InternalQuestion | null {
  const conf = findConfusables(target, allWords, 3);
  if (conf.length < MIN_DISTRACTORS) return null;
  const options: QuestionOption[] = [
    { en: target.en, zh: target.zh, correct: true, sim: 1 },
  ].concat(
    conf.map((c) => ({
      en: c.item.en,
      zh: c.item.zh,
      correct: false,
      sim: c.sim,
    })),
  );
  return {
    zh: target.zh,
    pos: target.pos || '',
    answer: target.en,
    options: _shuffle(options),
    topSim: Math.round(conf[0].sim * 100),
  };
}

function _evictCache(): void {
  while (_cacheKeys.length > MAX_CACHE) {
    const oldKey = _cacheKeys.shift();
    if (oldKey) delete _cache[oldKey];
  }
}

/** Get a confusable question (cached, re-shuffled each time) */
export function getQuestion(
  wordId: string,
  target: Item,
  allWords: Item[],
): ConfuseQuestion | null {
  _buildPool(allWords);
  if (Object.prototype.hasOwnProperty.call(_cache, wordId)) {
    const idx = _cacheKeys.indexOf(wordId);
    if (idx >= 0) _cacheKeys.splice(idx, 1);
    _cacheKeys.push(wordId);
    const cached = _cache[wordId];
    if (!cached) return null;
    return {
      zh: cached.zh,
      pos: cached.pos,
      answer: cached.answer,
      topSim: cached.topSim,
      options: _shuffle(cached.options),
    };
  }
  const q = _buildQuestion(target, allWords);
  if (q) {
    _cache[wordId] = {
      zh: q.zh,
      pos: q.pos,
      answer: q.answer,
      topSim: q.topSim,
      options: q.options,
    };
  } else {
    _cache[wordId] = null;
  }
  _cacheKeys.push(wordId);
  _evictCache();
  return q
    ? {
        zh: q.zh,
        pos: q.pos,
        answer: q.answer,
        topSim: q.topSim,
        options: _shuffle(q.options),
      }
    : null;
}

/** Check if a word can produce a confusable question */
export function hasConfusables(
  wordId: string,
  target: Item,
  allWords: Item[],
): boolean {
  return !!getQuestion(wordId, target, allWords);
}

/** Coverage stats (for dev self-check) */
export function coverage(allWords: Item[]): {
  pool: number;
  hit: number;
  rate: number;
} {
  const pool = _buildPool(allWords);
  let hit = 0;
  for (let i = 0; i < pool.length; i++) {
    if (_buildQuestion(pool[i], allWords)) hit++;
  }
  return {
    pool: pool.length,
    hit,
    rate: pool.length ? Math.round((hit / pool.length) * 100) : 0,
  };
}
