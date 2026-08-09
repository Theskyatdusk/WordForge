/**
 * Shadow（跟读/语音评测）—— 小程序占位实现。
 *
 * web 端用浏览器 Web Speech API（SpeechRecognition）做跟读评测。
 * 微信小程序没有该 API：原生 ASR 需要 recorder + 上传音频到后端做识别，
 * 成本高且依赖后端能力。这里先放占位实现，shadowSupported() 恒为 false，
 * 页面中跟读按钮会被条件渲染隐藏，保证编译通过且不影响其他学习模式。
 */

export interface ShadowResult {
  score?: number;
  heard?: string;
  error?: string;
}

export function shadowSupported(): boolean {
  return false;
}

export function shadowStart(
  _text: string,
  _callback: (result: ShadowResult) => void,
): void {
  // 小程序端暂不实现语音评测
  _callback({ error: '当前平台不支持跟读评测' });
}

export function shadowStop(): void {
  // no-op
}
