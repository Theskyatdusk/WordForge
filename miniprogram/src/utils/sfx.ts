import Taro from '@tarojs/taro';

/**
 * SFX —— 替代 web 端 utils/sfx.ts（那版用 Web Audio API 合成音效）。
 * 小程序没有 AudioContext 合成能力，改为用「短震动」做触觉反馈，
 * 零音频资源、零加载延迟，且在静音环境下依然有效。
 *
 * 如果后续要真音效，把 vibrate 换成预置 mp3 + InnerAudioContext 即可，
 * 调用方接口不变。
 */

let enabled = true;

function buzz(type: 'light' | 'medium' | 'heavy' = 'light') {
  if (!enabled) return;
  try {
    if (type === 'heavy') {
      Taro.vibrateLong();
    } else {
      Taro.vibrateShort({ type: type === 'medium' ? 'medium' : 'light' });
    }
  } catch {
    /* 部分设备/开发者工具不支持震动，静默忽略 */
  }
}

export const sfx = {
  setEnabled(v: boolean) { enabled = v; },
  isEnabled() { return enabled; },

  /** web 端用于解锁 AudioContext；小程序无需初始化，保留空实现以对齐调用方 */
  init: () => {},

  click: () => buzz('light'),
  toggle: () => buzz('light'),
  navigate: () => buzz('light'),
  flip: () => buzz('light'),
  add: () => buzz('light'),
  remove: () => buzz('light'),
  familiar: () => buzz('light'),

  correct: () => buzz('medium'),
  success: () => buzz('medium'),
  coin: () => buzz('medium'),
  unlock: () => buzz('medium'),
  checkin: () => buzz('medium'),

  wrong: () => buzz('heavy'),
  error: () => buzz('heavy'),
  complete: () => buzz('heavy'),
  levelUp: () => buzz('heavy'),
};
