/**
 * useTTS — React hook wrapping the TTS utility.
 * Provides reactive state for TTS availability, speaking status, and voices.
 */
import { useState, useEffect, useCallback } from 'react';
import { tts } from '../utils/tts';
import { useSettingsStore } from '../store/useSettingsStore';

export function useTTS() {
  const [available] = useState(() => tts.isAvailable());
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    if (!available) return;
    const updateVoices = () => {
      setVoices(tts.getVoices());
    };
    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.addEventListener('voiceschanged', updateVoices);
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        speechSynthesis.removeEventListener('voiceschanged', updateVoices);
      }
    };
  }, [available]);

  // Sync settings to TTS instance
  useEffect(() => {
    tts.setEnabled(settings.ttsEnabled);
    tts.setRate(settings.ttsRate);
    tts.setVolume(settings.ttsVolume);
    if (settings.ttsVoice) tts.setVoice(settings.ttsVoice);
  }, [settings.ttsEnabled, settings.ttsRate, settings.ttsVolume, settings.ttsVoice]);

  // Stop TTS on unmount
  useEffect(() => () => { tts.stop(); }, []);

  const speak = useCallback(
    (text: string, slow = false) => {
      if (!settings.ttsEnabled || !text) return;
      setSpeaking(true);
      tts.speak(text, {
        rate: slow ? 0.6 : settings.ttsRate,
        onend: () => setSpeaking(false),
        onerror: () => setSpeaking(false),
      });
    },
    [settings.ttsEnabled, settings.ttsRate],
  );

  const speakWord = useCallback(
    (word: string, slow = false) => {
      speak(word, slow);
    },
    [speak],
  );

  const speakSentence = useCallback(
    (sentence: string) => {
      if (!settings.ttsEnabled || !sentence) return;
      setSpeaking(true);
      tts.speakSentence(sentence);
      // Approximate end timer based on text length
      const estimatedDuration = Math.max(2000, sentence.length * 80);
      setTimeout(() => setSpeaking(false), estimatedDuration);
    },
    [settings.ttsEnabled],
  );

  const stop = useCallback(() => {
    tts.stop();
    setSpeaking(false);
  }, []);

  return {
    available,
    speaking,
    voices,
    speak,
    speakWord,
    speakSentence,
    stop,
  };
}
