/**
 * Visuals — Dual-coding visual anchors.
 *
 * Cognitive psychology dual-coding theory: encoding the same information
 * simultaneously through verbal + visual systems significantly boosts retention.
 * Each word/phrase gets a visual cue:
 *   - Prefer emoji anchors (covers many concrete words in the dataset);
 *   - Fall back to a colored first-letter stamp when no emoji is found.
 *
 * Also provides affix hints (suffix → part-of-speech) for mnemonic support.
 */

const EMOJI: Record<string, string> = {
  voluntary: '✋', orderly: '📏', responsible: '🛡️', scattered: '🍂',
  corridor: '🚪', poster: '🖼️', 'bulletin board': '📌', 'low-carbon': '🌱',
  effectively: '✅', foster: '🌱', 'social responsibility': '🤝',
  unforgettable: '⭐', valuable: '💎', gentle: '🕊️', priceless: '💎',
  tender: '🌸', sincere: '💗', subtly: '🤫', trivial: '🔹', pure: '💧',
  touching: '🥹', tough: '🪨', ordinary: '😐', melt: '🫠', heal: '🩹',
  trap: '🕸️', mark: '✍️', reshape: '🔄', strike: '💥', accumulate: '📈',
  enable: '🔓', despair: '😞', miracle: '✨', deed: '📜', blessing: '🙏',
  gesture: '🤟', potential: '🌟', devotion: '❤️', accompany: '🚶',
  existence: '🌍', 'light up': '💡', 'serve as': '🔧', 'circle back': '🔁',
  'move forward': '➡️', 'full of': '🈵', 'drive away': '💨',
  thrilled: '🤩', overjoyed: '🤩', 'overwhelmingly touched': '🥹',
  compassionate: '💗', 'warm-hearted': '💗', 'offer a helping hand': '🤝',
  "come to one's aid": '🤝', gaze: '👀', glance: '👀', stare: '👀',
  wander: '🚶', stride: '🚶', dash: '🏃', murmur: '🤫', whisper: '🤫',
  respond: '💬', transform: '🔄', significant: '🔑', vital: '🔑',
  "clasp one's hands": '🤝', 'wipe away tears': '😢', 'reach out a hand': '🤚',
  "spring to one's feet": '🏃', 'pace back and forth': '⏳',
  "slow down one's steps": '🐢',
  "a bright smile spread across one's face": '😊', 'eyes twinkle with delight': '✨',
  "tears blur one's vision": '💧',
  'account for': '📊', 'adapt to': '🦋', 'apply for': '📝', 'approve of': '👍',
  'benefit from': '🎁', 'contribute to': '➕', 'concentrate on': '🎯',
  'depend on': '🔗', 'result in': '➡️', 'stick to': '📌', 'break down': '💔',
  'break out': '💥', 'call off': '🚫', 'give up': '🏳️', 'give away': '🎁',
  'go through': '📖', 'look into': '🔍', 'pick up': '🆙', 'put off': '⏰',
  'turn out': '🔄', support: '💪', address: '📣', deliver: '📦',
  observe: '👁️', acknowledge: '🙏', 'reach out to people in need': '🤚',
  'devote oneself to public welfare': '❤️', 'make a positive difference': '💡',
  'set a good example': '💡', 'act out of pure kindness': '💗',
  'a small act of kindness goes a long way': '💗',
  'kindness is a bridge between hearts': '🌉',
  "warm the deepest corner of one's heart": '🔥',
  "plant seeds of kindness in people's hearts": '🌱',
  'create a warm cycle of giving and receiving': '🔄',
  'launch a voluntary campaign': '📣',
  "raise residents' awareness of environmental protection": '💡',
  'build a more harmonious neighborhood': '🕊️', 'participate in community governance': '🏛️',
  "a surge of joy welled up in sb's heart": '😄', 'be overwhelmed with gratitude': '🙏',
  'in high spirits': '🎈', 'feel a warm glow inside': '🔥', 'relief washed over sb': '😌',
  'without hesitation': '⏸️', 'all of a sudden': '💥', 'shortly afterwards': '⏳',
  'in the meanwhile': '⏳', 'as a result': '➡️', "what's more": '➕',
  'on the contrary': '🔄', generous: '🎁', selfless: '🤲', reliable: '🔒',
  modest: '🙇', determined: '💪', grateful: '🙏', ashamed: '😳',
  embarrassed: '😅', relieved: '😌', desperate: '🆘', awareness: '💡',
  gratitude: '🙏', harmony: '🕊️', sympathy: '💗', courage: '🦁',
  happy: '😊', kind: '💗', look: '👀', walk: '🚶', say: '💬',
  change: '🔄', important: '🔑', help: '🤝', moved: '🥹',
  'take part in': '🙋', 'be split into': '✂️', 'set off': '🚀', 'sweep away': '🧹',
  'offer assistance to': '🤲', 'tidy up': '🧹', 'appeal to': '📢',
  'show concern for': '💗', 'gain great benefits from': '🎁',
  'not merely...but also...': '🔗',
};

const PALETTE = [
  '#0D9488', '#7C3AED', '#EA580C', '#DC2626',
  '#0891B2', '#CA8A04', '#2563EB', '#DB2777',
];

/** Deterministic color from string hash */
export function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

/** Return emoji for a word/phrase, or null if not mapped */
export function getEmoji(en: string): string | null {
  if (!en) return null;
  const key = en.toLowerCase().trim().replace(/\s+/g, ' ');
  return EMOJI[key] || null;
}

/** Return JSX-compatible visual anchor data for a word */
export function getVisual(en: string): {
  emoji: string | null;
  letter: string;
  color: string;
} {
  const emoji = getEmoji(en);
  const letter = ((en || '?').trim().charAt(0) || '?').toUpperCase();
  const color = hashColor(en || '?');
  return { emoji, letter, color };
}

/** Map backend icon names (e.g. "book", "edit") to emoji */
const CHAPTER_ICON_MAP: Record<string, string> = {
  book: '📖',
  edit: '✏️',
  'list-check': '📋',
  heart: '❤️',
  'face-smile': '😊',
  'academic-cap': '🎓',
  bookmark: '🔖',
  trophy: '🏆',
  target: '🎯',
  flame: '🔥',
  star: '⭐',
  pen: '🖊️',
  pencil: '✏️',
  lightbulb: '💡',
  rocket: '🚀',
  brain: '🧠',
  globe: '🌍',
  music: '🎵',
  camera: '📷',
  code: '💻',
};

/** Get chapter icon emoji from backend icon name or emoji string */
export function getChapterIcon(icon: string | undefined | null): string {
  if (!icon) return '📖';
  // If it's already an emoji (length <= 4 and not pure ASCII), return as-is
  if (icon.length <= 4 && /[^\x00-\x7F]/.test(icon)) return icon;
  // Map from backend icon name
  return CHAPTER_ICON_MAP[icon.toLowerCase()] || '📖';
}

/** Suffix → part-of-speech hint (35 rules). Returns null for short words. */
export function affixHint(en: string): string | null {
  if (!en) return null;
  const w = en.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length < 5) return null;
  const map: [string, string][] = [
    ['tion', '名词'], ['sion', '名词'], ['ment', '名词'], ['ness', '名词'], ['ity', '名词'],
    ['ance', '名词'], ['ence', '名词'], ['ship', '名词'], ['hood', '名词'], ['ery', '名词'],
    ['age', '名词'], ['dom', '名词'], ['ist', '名词(人)'], ['er', '名词(人)'], ['or', '名词(人)'],
    ['ism', '名词'], ['ful', '形容词'], ['less', '形容词'], ['able', '形容词'], ['ible', '形容词'],
    ['al', '形容词'], ['ous', '形容词'], ['ive', '形容词'], ['ic', '形容词'], ['ish', '形容词'],
    ['ant', '形容词'], ['ent', '形容词'], ['ary', '形容词'], ['some', '形容词'], ['y', '形容词'],
    ['ize', '动词'], ['ise', '动词'], ['ify', '动词'], ['ate', '动词/形容词'], ['ly', '副词/形容词'],
  ];
  for (const [suf, pos] of map) {
    if (w.endsWith(suf) && w.length > suf.length + 1) {
      return `词缀提示：后缀 -${suf} 多为${pos}`;
    }
  }
  return null;
}
