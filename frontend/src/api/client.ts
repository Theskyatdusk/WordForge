/**
 * API Client — Axios instance with base URL /api and typed API functions.
 * The frontend primarily uses localStorage for offline-first functionality.
 * The API is used as an optional enhancement layer when the backend is available.
 */
import axios from 'axios';
import type {
  ApiResponse,
  Chapter,
  VocabData,
} from '../types/index';

const client = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

/** Log API errors to console for debugging — distinguishes "no data" from "backend unavailable" */
function logApiError(label: string, err: unknown): void {
  if (axios.isAxiosError(err)) {
    if (err.code === 'ECONNABORTED') {
      console.warn(`[API] ${label} timeout`);
    } else if (err.response) {
      console.warn(`[API] ${label} ${err.response.status}: ${err.response.statusText}`);
    } else {
      // Network error — backend likely not running, suppress to avoid console spam
    }
  }
}

// ===== Vocabulary =====
export const vocabApi = {
  /** Get the full vocabulary data (all chapters) — backend returns list[ChapterOut] directly */
  get: async (): Promise<ApiResponse<VocabData>> => {
    try {
      const res = await client.get<Chapter[]>('/vocabulary/chapters');
      return { success: true, data: { chapters: res.data } };
    } catch {
      return { success: false };
    }
  },
  /** Get a single chapter */
  getChapter: async (chapterId: string): Promise<ApiResponse<Chapter>> => {
    try {
      const res = await client.get<Chapter>(`/vocabulary/chapters/${chapterId}`);
      return { success: true, data: res.data };
    } catch {
      return { success: false };
    }
  },
};

// ===== Progress (optional backend sync) =====
export const progressApi = {
  getAll: () => client.get('/progress/').then((r) => r.data).catch((e) => { logApiError('progress.getAll', e); return []; }),
  update: (wordId: string, grade: boolean | string, respondedMs?: number) =>
    client.post('/progress/', { word_id: wordId, grade, responded_ms: respondedMs }).then((r) => r.data).catch((e) => { logApiError('progress.update', e); return null; }),
  getStats: () => client.get('/progress/stats/overview').then((r) => r.data).catch((e) => { logApiError('progress.getStats', e); return null; }),
  getDue: (limit = 50) => client.get('/progress/due/list', { params: { limit } }).then((r) => r.data).catch((e) => { logApiError('progress.getDue', e); return []; }),
};

// ===== Wordbook (optional backend sync) =====
export const wordbookApi = {
  getAll: () => client.get('/wordbook/').then((r) => r.data).catch((e) => { logApiError('wordbook.getAll', e); return []; }),
  add: (entry: Record<string, unknown>) => client.post('/wordbook/', entry).then((r) => r.data).catch((e) => { logApiError('wordbook.add', e); return null; }),
  remove: (wordId: string) => client.delete(`/wordbook/${wordId}`).then((r) => r.data).catch((e) => { logApiError('wordbook.remove', e); return null; }),
};

// ===== Study (optional backend sync) =====
export const studyApi = {
  record: (data: Record<string, unknown>) => client.post('/study/session', data).then((r) => r.data).catch((e) => { logApiError('study.record', e); return null; }),
  getSessions: () => client.get('/study/sessions').then((r) => r.data).catch((e) => { logApiError('study.getSessions', e); return []; }),
  getToday: () => client.get('/study/today').then((r) => r.data).catch((e) => { logApiError('study.getToday', e); return null; }),
};

// ===== Check-in / Streak (optional backend sync) =====
export const checkinApi = {
  checkin: () => client.post('/checkin/').then((r) => r.data).catch((e) => { logApiError('checkin.checkin', e); return null; }),
  getStreak: () => client.get('/checkin/streak').then((r) => r.data).catch((e) => { logApiError('checkin.getStreak', e); return null; }),
  getToday: () => client.get('/checkin/today').then((r) => r.data).catch((e) => { logApiError('checkin.getToday', e); return null; }),
};

// ===== Settings (optional backend sync) =====
export const settingsApi = {
  get: () => client.get('/settings/').then((r) => r.data).catch((e) => { logApiError('settings.get', e); return null; }),
  update: (data: Record<string, unknown>) => client.put('/settings/', { settings: data }).then((r) => r.data).catch((e) => { logApiError('settings.update', e); return null; }),
};

// ===== Shop (optional backend sync) =====
export const shopApi = {
  getItems: () => client.get('/shop/items').then((r) => r.data).catch((e) => { logApiError('shop.getItems', e); return null; }),
  buy: (kind: string, itemId: string) => client.post('/shop/buy', { kind, item_id: itemId }).then((r) => r.data).catch((e) => { logApiError('shop.buy', e); return null; }),
  equip: (kind: string, itemId: string) => client.post('/shop/equip', { kind, item_id: itemId }).then((r) => r.data).catch((e) => { logApiError('shop.equip', e); return null; }),
  getDailyTasks: () => client.get('/shop/daily-tasks').then((r) => r.data).catch((e) => { logApiError('shop.getDailyTasks', e); return []; }),
  claimTask: (taskId: string) => client.post('/shop/daily-tasks', { task_id: taskId, action: 'claim' }).then((r) => r.data).catch((e) => { logApiError('shop.claimTask', e); return null; }),
};

// ===== Sync (backend persistence) =====
export const syncApi = {
  load: () => client.get('/sync/').then((r) => r.data).catch((e) => { logApiError('sync.load', e); return null; }),
  save: (data: Record<string, unknown>) => client.post('/sync/', data).then((r) => r.data).catch((e) => { logApiError('sync.save', e); return null; }),
  upload: (data: Record<string, unknown>) => client.post('/sync/upload', data).then((r) => r.data).catch((e) => { logApiError('sync.upload', e); return null; }),
  download: () => client.get('/sync/download').then((r) => r.data).catch((e) => { logApiError('sync.download', e); return null; }),
  reset: () => client.post('/sync/reset').then((r) => r.data).catch((e) => { logApiError('sync.reset', e); return null; }),
};

export default client;
