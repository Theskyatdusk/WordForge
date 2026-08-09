import Taro from '@tarojs/taro'

// 替代原前端中散落的 localStorage.getItem / setItem。
// 小程序用 Taro.getStorageSync / setStorageSync（同步 API，底层 wx 存储）。
export const storage = {
  get<T = any>(key: string, fallback?: T): T | undefined {
    try {
      const v = Taro.getStorageSync(key)
      return v === '' || v === undefined || v === null ? fallback : v
    } catch {
      return fallback
    }
  },
  set(key: string, value: any): void {
    try {
      Taro.setStorageSync(key, value)
    } catch {
      /* 忽略写入异常（如存储空间满） */
    }
  },
  remove(key: string): void {
    try {
      Taro.removeStorageSync(key)
    } catch {
      /* noop */
    }
  }
}
