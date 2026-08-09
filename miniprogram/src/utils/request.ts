import Taro from '@tarojs/taro';
import { API_BASE } from '../config';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RequestOptions {
  method?: Method;
  data?: any;
  header?: Record<string, string>;
  /** 静默模式：失败时不弹 toast（列表轮询等场景用） */
  silent?: boolean;
}

// 替代原前端 api/client.ts 中的 axios 实例。
// 小程序运行时没有 XMLHttpRequest，必须走 Taro.request（底层 wx.request）。
// 注意：域名必须在微信公众平台「开发管理 → 服务器域名 → request 合法域名」里配置。
export function request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
  const token = Taro.getStorageSync('access_token');
  return new Promise<T>((resolve, reject) => {
    Taro.request({
      url: `${API_BASE}${url}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.header || {}),
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
        } else {
          if (!options.silent) {
            Taro.showToast({ title: `请求失败 (${res.statusCode})`, icon: 'none' });
          }
          reject({ statusCode: res.statusCode, data: res.data });
        }
      },
      fail: (err) => {
        if (!options.silent) {
          Taro.showToast({ title: '网络异常', icon: 'none' });
        }
        reject(err);
      },
    });
  });
}

/**
 * 兼容旧签名 request({ url, method, data })。
 * 新代码请统一用具名导出 request(url, opts)。
 */
export default function legacyRequest<T = any>(
  options: RequestOptions & { url: string },
): Promise<T> {
  const { url, ...rest } = options;
  return request<T>(url, rest);
}
