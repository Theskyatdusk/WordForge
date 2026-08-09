/**
 * Date/duration formatting helpers.
 */

const DAY_MS = 86400000;

/** Format a timestamp as YYYY-MM-DD (local time) */
export function formatDate(ts: number | null | undefined): string {
  if (!ts) return '--';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format a timestamp as YYYY-MM-DD HH:mm */
export function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return '--';
  const d = new Date(ts);
  const date = formatDate(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${date} ${h}:${min}`;
}

/** Today's date string YYYY-MM-DD */
export function todayStr(): string {
  return formatDate(Date.now());
}

/** Format milliseconds as human-readable duration, e.g. "1分23秒" or "45秒" */
export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '0秒';
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}秒`;
  return `${min}分${sec}秒`;
}

/** Format a reaction-time in milliseconds, e.g. "1.2s" */
export function formatReactionTime(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '--';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Relative time from now, e.g. "3天前", "刚刚" */
export function relativeTime(ts: number | null | undefined): string {
  if (!ts) return '从未';
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < DAY_MS) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 7 * DAY_MS) return `${Math.floor(diff / DAY_MS)}天前`;
  return formatDate(ts);
}

/** Days until a future timestamp, e.g. "3天后", "今天", "已逾期" */
export function daysUntil(ts: number | null | undefined): string {
  if (!ts) return '未安排';
  const diff = ts - Date.now();
  if (diff < 0) return '已逾期';
  const days = Math.ceil(diff / DAY_MS);
  if (days === 0) return '今天';
  if (days === 1) return '明天';
  return `${days}天后`;
}

/** Format a number with thousand separators */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** Format a percentage value 0-100 */
export function formatPercent(value: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

/** Get the day-of-week label in Chinese */
export function dayOfWeek(ts: number | null | undefined): string {
  if (!ts) return '';
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return labels[new Date(ts).getDay()];
}

/** Get the last N days as date strings (YYYY-MM-DD), oldest first */
export function lastNDays(n: number): string[] {
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY_MS);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    result.push(`${y}-${m}-${day}`);
  }
  return result;
}
