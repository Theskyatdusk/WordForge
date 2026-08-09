/**
 * API Client —— 与 web 端 frontend/src/api/client.ts **签名完全一致**，
 * 这样页面代码可以近乎零改动地搬过来。
 *
 * 唯一差异：底层 axios → Taro.request（见 utils/request.ts），
 * 且 baseURL 不能是相对路径 '/api'，必须是完整 HTTPS 域名（见 config.ts）。
 */
import { request } from '../utils/request';
import type { ApiResponse, Chapter, VocabData } from '../types/index';

// 所有请求默认静默失败：本项目是 offline-first，后端只是增强层
function get<T>(url: string, fallback: T): Promise<T> {
  return request<T>(url, { silent: true }).catch(() => fallback);
}

function post<T>(url: string, data?: any, fallback: T | null = null): Promise<T | null> {
  return request<T>(url, { method: 'POST', data, silent: true }).catch(() => fallback);
}

// ===== 词库 =====
export const vocabApi = {
  /** 拉取全部章节；后端直接返回 list[ChapterOut] */
  get: async (): Promise<ApiResponse<VocabData>> => {
    try {
      const chapters = await request<Chapter[]>('/vocabulary/chapters', { silent: true });
      return { success: true, data: { chapters } };
    } catch {
      return { success: false };
    }
  },
  getChapter: async (chapterId: string): Promise<ApiResponse<Chapter>> => {
    try {
      const data = await request<Chapter>(`/vocabulary/chapters/${chapterId}`, { silent: true });
      return { success: true, data };
    } catch {
      return { success: false };
    }
  },
};

// ===== 学习进度 =====
export const progressApi = {
  getAll: () => get<any[]>('/progress/', []),
  update: (wordId: string, grade: boolean | string, respondedMs?: number) =>
    post('/progress/', { word_id: wordId, grade, responded_ms: respondedMs }),
  getStats: () => get<any>('/progress/stats/overview', null),
  getDue: (limit = 50) => get<string[]>(`/progress/due/list?limit=${limit}`, []),
};

// ===== 生词本 =====
export const wordbookApi = {
  getAll: () => get<any[]>('/wordbook/', []),
  add: (entry: Record<string, unknown>) => post('/wordbook/', entry),
  remove: (wordId: string) =>
    request(`/wordbook/${wordId}`, { method: 'DELETE', silent: true }).catch(() => null),
};

// ===== 学习会话 =====
export const studyApi = {
  record: (data: Record<string, unknown>) => post('/study/session', data),
  getSessions: () => get<any[]>('/study/sessions', []),
  getToday: () => get<any>('/study/today', null),
};

// ===== 打卡 =====
export const checkinApi = {
  checkin: () => post('/checkin/'),
  getStreak: () => get<any>('/checkin/streak', null),
  getToday: () => get<any>('/checkin/today', null),
};

// ===== 设置 =====
export const settingsApi = {
  get: () => get<any>('/settings/', null),
  update: (data: Record<string, unknown>) =>
    request('/settings/', { method: 'PUT', data: { settings: data }, silent: true }).catch(() => null),
};

// ===== 商店 =====
export const shopApi = {
  getItems: () => get<any>('/shop/items', null),
  buy: (kind: string, itemId: string) => post('/shop/buy', { kind, item_id: itemId }),
  equip: (kind: string, itemId: string) => post('/shop/equip', { kind, item_id: itemId }),
  getDailyTasks: () => get<any[]>('/shop/daily-tasks', []),
  claimTask: (taskId: string) => post('/shop/daily-tasks', { task_id: taskId, action: 'claim' }),
};

// ===== 云同步 =====
export const syncApi = {
  load: () => get<any>('/sync/', null),
  save: (data: Record<string, unknown>) => post('/sync/', data),
  upload: (data: Record<string, unknown>) => post('/sync/upload', data),
  download: () => get<any>('/sync/download', null),
  reset: () => post('/sync/reset'),
};
