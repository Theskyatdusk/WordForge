/**
 * TTS Module — Word pronunciation using Web Speech API.
 *
 * Based on the original tts.js implementation: directly calls
 * speechSynthesis.speak() without pre-checks. The browser handles
 * voice loading internally — no need for secure-context or voice
 * checks that only slow things down.
 *
 * Youdao audio is only used as a last-resort fallback when
 * speechSynthesis is completely unavailable or errors out.
 */

interface SpeakOptions {
  voice?: SpeechSynthesisVoice | null;
  rate?: number;
  pitch?: number;
  volume?: number;
  onend?: (() => void) | null;
  onerror?: ((e: SpeechSynthesisErrorEvent) => void) | null;
}

class TTSClass {
  voices: SpeechSynthesisVoice[] = [];
  preferredVoice: SpeechSynthesisVoice | null = null;
  enabled = true;
  rate = 0.9;
  volume = 1;
  autoPlay = true;
  private _keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private _currentAudio: HTMLAudioElement | null = null;

  init(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('[TTS] Speech Synthesis not supported, will use audio fallback');
      return;
    }
    this.loadVoices();
    speechSynthesis.addEventListener('voiceschanged', () => this.loadVoices());
  }

  loadVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.voices = speechSynthesis.getVoices();
    this.preferredVoice =
      this.voices.find((v) => v.lang === 'en-US' && v.name.includes('Google')) ||
      this.voices.find((v) => v.lang === 'en-US') ||
      this.voices.find((v) => v.lang === 'en-GB') ||
      this.voices.find((v) => v.lang.startsWith('en')) ||
      null;
  }

  speak(text: string, options: SpeakOptions = {}): void {
    if (!this.enabled || !text) return;

    // Stop any current audio/speech
    this._stopAudio();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
    }

    // Primary: Web Speech API — instant, no network needed
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = options.voice || this.preferredVoice;
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang || 'en-US';
        } else {
          utterance.lang = 'en-US';
        }
        utterance.rate = options.rate ?? this.rate;
        utterance.pitch = options.pitch ?? 1;
        utterance.volume = options.volume ?? this.volume;

        if (options.onend) utterance.onend = options.onend;
        if (options.onerror) utterance.onerror = options.onerror;

        // Safety net: if speech fails silently, fall back to Youdao audio
        let started = false;
        utterance.onstart = () => { started = true; };

        const fallbackTimer = setTimeout(() => {
          if (!started) {
            console.info('[TTS] speechSynthesis silent after 1.5s, trying Youdao audio');
            speechSynthesis.cancel();
            this._speakViaAudio(text, options);
          }
        }, 1500);

        const origOnend = utterance.onend;
        const origOnerror = utterance.onerror;
        utterance.onend = (e) => {
          clearTimeout(fallbackTimer);
          this._stopKeepalive();
          if (origOnend) origOnend.call(utterance, e);
        };
        utterance.onerror = (e) => {
          clearTimeout(fallbackTimer);
          this._stopKeepalive();
          if (origOnerror) origOnerror.call(utterance, e);
          // Fall back to Youdao audio on error
          this._speakViaAudio(text, options);
        };

        speechSynthesis.speak(utterance);
        this._startKeepalive();
        return;
      } catch (e) {
        console.warn('[TTS] speechSynthesis error:', e);
      }
    }

    // Fallback: Youdao Dictionary audio (only if speechSynthesis unavailable)
    this._speakViaAudio(text, options);
  }

  /**
   * Speak using Youdao Dictionary audio API.
   * Only used as fallback when speechSynthesis is unavailable.
   */
  private _speakViaAudio(text: string, options: SpeakOptions): void {
    if (!text) return;

    // Stop any currently playing audio
    this._stopAudio();

    const encoded = encodeURIComponent(text.trim());
    const url = `https://dict.youdao.com/dictvoice?audio=${encoded}&type=1`;

    const audio = new Audio(url);
    audio.volume = options.volume ?? this.volume;
    const rate = options.rate ?? this.rate;
    audio.playbackRate = Math.max(0.5, Math.min(2, rate));

    audio.onended = () => {
      this._currentAudio = null;
      if (options.onend) options.onend();
    };

    audio.onerror = () => {
      this._currentAudio = null;
      console.warn('[TTS] Youdao audio failed for:', text);
      if (options.onerror) options.onerror(new Event('error') as SpeechSynthesisErrorEvent);
    };

    this._currentAudio = audio;

    audio.play().catch((e) => {
      console.warn('[TTS] Audio play failed:', e.message);
      this._currentAudio = null;
    });
  }

  private _stopAudio(): void {
    if (this._currentAudio) {
      this._currentAudio.pause();
      this._currentAudio.onended = null;
      this._currentAudio.onerror = null;
      this._currentAudio.src = '';
      this._currentAudio = null;
    }
  }

  /**
   * Preload audio for a word (for Youdao fallback path).
   */
  preload(text: string): void {
    // No-op when using speechSynthesis — browser handles voice loading.
    // Only preload if we know speechSynthesis is unavailable.
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (!text) return;
      const encoded = encodeURIComponent(text.trim());
      const url = `https://dict.youdao.com/dictvoice?audio=${encoded}&type=1`;
      // Trigger browser cache by loading the URL
      const img = new Image();
      img.src = url;
    }
  }

  private _startKeepalive(): void {
    this._stopKeepalive();
    this._keepaliveTimer = setInterval(() => {
      if (speechSynthesis.speaking) {
        speechSynthesis.pause();
        speechSynthesis.resume();
      } else {
        this._stopKeepalive();
      }
    }, 10000);
  }

  private _stopKeepalive(): void {
    if (this._keepaliveTimer) {
      clearInterval(this._keepaliveTimer);
      this._keepaliveTimer = null;
    }
  }

  speakWord(word: string, slow = false): void {
    this.speak(word, { rate: slow ? 0.6 : this.rate });
  }

  speakSentence(sentence: string): void {
    this.speak(sentence, { rate: this.rate * 0.95 });
  }

  stop(): void {
    this._stopKeepalive();
    this._stopAudio();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }

  isAvailable(): boolean {
    return typeof window !== 'undefined';
  }

  isSpeechSynthesisAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices.filter((v) => v.lang.startsWith('en'));
  }

  setVoice(name: string): void {
    const voice = this.voices.find((v) => v.name === name);
    if (voice) this.preferredVoice = voice;
  }

  setRate(rate: number): void {
    this.rate = Math.max(0.5, Math.min(2, rate));
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stop();
    return this.enabled;
  }
}

export const tts = new TTSClass();

// Auto-init on browser load
if (typeof window !== 'undefined') {
  tts.init();
}
