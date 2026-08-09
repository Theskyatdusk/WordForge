import Taro from '@tarojs/taro';
import { API_BASE } from '../config';

/**
 * TTS —— 替代 web 端 utils/tts.ts 里的浏览器 speechSynthesis。
 * 小程序没有 Web Speech API，改为：
 *   1) 请求后端 /api/tts?text=xxx 拿到音频 URL；
 *   2) 用 InnerAudioContext 播放。
 *
 * ⚠️ 音频域名需在微信公众平台配置 downloadFile 合法域名。
 */

let audioCtx: Taro.InnerAudioContext | null = null;

// 内存级缓存：同一个词反复点发音时不重复请求后端
const urlCache = new Map<string, string>();

const state = {
  enabled: true,
  rate: 0.9,
  volume: 1,
  voice: null as string | null,
};

function getCtx(): Taro.InnerAudioContext {
  if (!audioCtx) {
    audioCtx = Taro.createInnerAudioContext();
    audioCtx.obeyMuteSwitch = false; // 静音键下也能发音，背单词场景更合理
  }
  return audioCtx;
}

function cacheKey(text: string, slow: boolean): string {
  return `${slow ? 's' : 'n'}|${state.voice || ''}|${text}`;
}

async function fetchUrl(text: string, slow: boolean): Promise<string | null> {
  const key = cacheKey(text, slow);
  const hit = urlCache.get(key);
  if (hit) return hit;

  const rate = slow ? Math.max(0.5, state.rate - 0.3) : state.rate;
  const params = [
    `text=${encodeURIComponent(text)}`,
    `rate=${rate}`,
    state.voice ? `voice=${encodeURIComponent(state.voice)}` : '',
  ]
    .filter(Boolean)
    .join('&');

  try {
    const res = await Taro.request({ url: `${API_BASE}/tts?${params}`, method: 'GET' });
    const url = (res.data as any)?.url;
    if (!url) return null;
    urlCache.set(key, url);
    return url;
  } catch {
    return null;
  }
}

export const tts = {
  setEnabled(v: boolean) { state.enabled = v; },
  setRate(v: number) { state.rate = v; urlCache.clear(); },
  setVolume(v: number) { state.volume = v; if (audioCtx) audioCtx.volume = v; },
  setVoice(v: string | null) { state.voice = v; urlCache.clear(); },
  isEnabled() { return state.enabled; },

  /** 播放任意文本；slow=true 时降速（跟读/拼写场景） */
  async speak(text: string, slow = false): Promise<void> {
    if (!state.enabled || !text) return;
    const url = await fetchUrl(text, slow);
    if (!url) return;
    const ctx = getCtx();
    ctx.stop();
    ctx.volume = state.volume;
    ctx.src = url;
    ctx.play();
  },

  speakWord(text: string) { return this.speak(text, false); },
  speakSentence(text: string) { return this.speak(text, false); },
  speakSlow(text: string) { return this.speak(text, true); },

  stop() { if (audioCtx) audioCtx.stop(); },

  destroy() {
    if (audioCtx) {
      audioCtx.destroy();
      audioCtx = null;
    }
  },
};

// 兼容早期写法
export const speak = (text: string) => tts.speak(text);
export const stopSpeak = () => tts.stop();
