/**
 * Shadow — 语境影子跟读 (Speech Recognition scoring)
 *
 * Uses Web Speech API SpeechRecognition for real-time voice recognition,
 * compares user's speech with target text using normalized similarity.
 * Gracefully degrades when not supported.
 */
import type { ShadowResult } from '../types/index';

let _rec: any = null;

/** Check if speech recognition is supported */
export function shadowSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
}

/** Stop any ongoing recognition */
export function shadowStop(): void {
  if (_rec) {
    try { _rec.abort(); } catch (_) { /* noop */ }
    try { _rec.stop(); } catch (_) { /* noop */ }
    _rec = null;
  }
}

function _normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

function _similarity(a: string, b: string): number {
  a = _normalize(a);
  b = _normalize(b);
  if (!a && !b) return 0;
  if (a === b) return 1;
  const dist = _levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Start shadowing (speech recognition) for the given target text.
 * Calls onResult with { heard, score } or { error }.
 */
export function shadowStart(target: string, onResult: (result: ShadowResult) => void): void {
  if (!shadowSupported()) {
    onResult({ error: '当前浏览器不支持语音识别' });
    return;
  }
  shadowStop();

  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const rec = new SR();
  _rec = rec;
  rec.lang = 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = false;

  let done = false;
  const finish = (res: ShadowResult) => {
    if (done) return;
    done = true;
    _rec = null;
    onResult(res);
  };

  rec.onresult = (e: any) => {
    const heard = e.results?.[0]?.[0]?.transcript || '';
    const score = _similarity(heard, target);
    finish({ heard, score: Math.round(score * 100) });
  };
  rec.onerror = (e: any) => {
    finish({ error: e?.error || '识别错误' });
  };
  rec.onend = () => {
    finish({ error: '未识别到语音，请再试一次' });
  };

  try {
    rec.start();
  } catch (err: any) {
    finish({ error: '无法启动语音识别：' + (err?.message || err) });
  }
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', shadowStop);
}
