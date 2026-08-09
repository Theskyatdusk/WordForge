/**
 * Achievements — Achievement definitions and checking logic.
 *
 * Defines all unlockable achievements and provides a function to check
 * which new achievements should be unlocked based on current progress.
 */
import type { Achievement, Streak, LevelInfo, WordbookEntry, StudySession } from '../types/index';

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_step', title: '第一步', desc: '完成首次学习', icon: '🌟' },
  { id: 'streak3', title: '三日之寒', desc: '连续打卡 3 天', icon: '🔥' },
  { id: 'streak7', title: '一周坚持', desc: '连续打卡 7 天', icon: '🔥' },
  { id: 'streak30', title: '月度达人', desc: '连续打卡 30 天', icon: '🏆' },
  { id: 'studied50', title: '勤学苦练', desc: '累计学习 50 词次', icon: '📚' },
  { id: 'studied100', title: '百词斩', desc: '累计学习 100 词次', icon: '📚' },
  { id: 'studied500', title: '学海无涯', desc: '累计学习 500 词次', icon: '📚' },
  { id: 'mastered10', title: '小有所成', desc: '掌握 10 个词汇', icon: '⭐' },
  { id: 'mastered50', title: '词汇达人', desc: '掌握 50 个词汇', icon: '⭐' },
  { id: 'mastered100', title: '词汇大师', desc: '掌握 100 个词汇', icon: '👑' },
  { id: 'wordbook10', title: '善用书签', desc: '生词本收集 10 词', icon: '🔖' },
  { id: 'perfect', title: '全对达人', desc: '单日准确率 100% 且 ≥10 词', icon: '✅' },
  { id: 'quiz50', title: '测验高手', desc: '完成 50 次学习场次', icon: '🎯' },
  { id: 'level5', title: '初露锋芒', desc: '达到 5 级', icon: '⚔️' },
  { id: 'level10', title: '渐入佳境', desc: '达到 10 级', icon: '🎖️' },
];

export interface AchievementCheckResult {
  newAchievements: Achievement[];
  allUnlocked: string[];
}

/**
 * Check which achievements should be unlocked based on current stats.
 * Returns newly unlocked achievements (not in alreadyUnlocked) and the full set.
 */
/** Local date helper — avoids UTC timezone issues in toISOString() */
function localDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ID-based achievement lookup — avoids fragile array index references */
function findById(id: string): Achievement {
  return ACHIEVEMENTS.find((a) => a.id === id)!;
}

export function checkAchievements(
  alreadyUnlocked: string[],
  stats: {
    streak: Streak;
    level: LevelInfo;
    studyHistory: StudySession[];
    wordbook: WordbookEntry[];
    masteredCount: number;
    totalStudied: number;
    totalSessions: number;
  },
): AchievementCheckResult {
  const allUnlocked = new Set(alreadyUnlocked);
  const newAchievements: Achievement[] = [];

  const check = (id: string, condition: boolean) => {
    if (condition && !allUnlocked.has(id)) {
      allUnlocked.add(id);
      newAchievements.push(findById(id));
    }
  };

  // First step: any study session
  check('first_step', stats.totalStudied > 0);

  // Streak achievements
  check('streak3', stats.streak.current >= 3);
  check('streak7', stats.streak.current >= 7);
  check('streak30', stats.streak.current >= 30);

  // Studied count achievements
  check('studied50', stats.totalStudied >= 50);
  check('studied100', stats.totalStudied >= 100);
  check('studied500', stats.totalStudied >= 500);

  // Mastered count achievements
  check('mastered10', stats.masteredCount >= 10);
  check('mastered50', stats.masteredCount >= 50);
  check('mastered100', stats.masteredCount >= 100);

  // Wordbook achievements
  check('wordbook10', stats.wordbook.length >= 10);

  // Perfect day: 100% accuracy with >= 10 words studied today (local date)
  const today = localDateStr();
  const todayEntry = stats.studyHistory.find((s) => s.date === today);
  const isPerfect =
    todayEntry &&
    todayEntry.words_studied >= 10 &&
    todayEntry.wrong === 0 &&
    todayEntry.correct > 0;
  check('perfect', !!isPerfect);

  // Quiz count achievements (total sessions)
  check('quiz50', stats.totalSessions >= 50);

  // Level achievements
  check('level5', stats.level.level >= 5);
  check('level10', stats.level.level >= 10);

  return { newAchievements, allUnlocked: Array.from(allUnlocked) };
}

/** Badge definitions for the shop */
export const BADGES: Array<{ id: string; name: string; emoji: string; desc: string; price: number }> = [
  { id: 'badge_scholar', name: '学者徽章', emoji: '🎓', desc: '展现你的学习热情', price: 30 },
  { id: 'badge_fire', name: '火焰徽章', emoji: '🔥', desc: '燃烧的学习激情', price: 50 },
  { id: 'badge_star', name: '星辰徽章', emoji: '⭐', desc: '闪耀的词汇之星', price: 50 },
  { id: 'badge_crown', name: '皇冠徽章', emoji: '👑', desc: '词汇王者风范', price: 100 },
  { id: 'badge_diamond', name: '钻石徽章', emoji: '💎', desc: '璀璨的钻石荣耀', price: 150 },
  { id: 'badge_rocket', name: '火箭徽章', emoji: '🚀', desc: '一飞冲天的动力', price: 80 },
  { id: 'badge_brain', name: '智慧徽章', emoji: '🧠', desc: '智慧与知识的象征', price: 80 },
  { id: 'badge_trophy', name: '奖杯徽章', emoji: '🏆', desc: '胜利与成就的标志', price: 120 },
];
