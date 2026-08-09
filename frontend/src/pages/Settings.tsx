/**
 * Settings — User settings with toggles, sliders, and selectors.
 */
import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  Target,
  GraduationCap,
  Gauge,
  Sparkles,
  RotateCcw,
  Check,
  ListChecks,
  FastForward,
  Clock,
  Type,
  Tag,
  RefreshCw,
} from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useUIStore } from '../store/useUIStore';
import { useTTS } from '../hooks/useTTS';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Toggle } from '../components/ui/Toggle';
import { Modal } from '../components/ui/Modal';
import { sfx } from '../utils/sfx';
import type { Settings as SettingsType } from '../types/index';

interface SettingRowProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  desc?: string;
  children: React.ReactNode;
}

function SettingRow({ icon, iconBg, iconColor, title, desc, children }: SettingRowProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>
          {title}
        </p>
        {desc && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {desc}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div>
      <h3 className="font-bold text-sm mb-2 px-1" style={{ color: 'var(--text-secondary)' }}>
        {title}
      </h3>
      <Card padding="md">
        <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
          {children}
        </div>
      </Card>
    </div>
  );
}

const STUDY_MODES: Array<{ id: string; label: string }> = [
  { id: 'flashcard', label: '卡片记忆' },
  { id: 'quiz', label: '选择题' },
  { id: 'spelling', label: '拼写练习' },
  { id: 'listening', label: '听力训练' },
];

const FEEDBACK_LEVELS: Array<{ id: SettingsType['feedbackLevel']; label: string }> = [
  { id: 'strong', label: '强烈' },
  { id: 'medium', label: '适中' },
  { id: 'weak', label: '柔和' },
];

const FONT_SIZES: Array<{ id: SettingsType['fontSize']; label: string }> = [
  { id: 'small', label: '小' },
  { id: 'medium', label: '中' },
  { id: 'large', label: '大' },
];

const QUIZ_OPTIONS: Array<{ id: 4 | 6; label: string }> = [
  { id: 4, label: '4个' },
  { id: 6, label: '6个' },
];

export function Settings() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const reset = useSettingsStore((s) => s.reset);
  const addToast = useUIStore((s) => s.addToast);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const theme = useUIStore((s) => s.theme);
  const ttsHook = useTTS();

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = () => {
    sfx.click();
    reset();
    addToast('设置已重置', 'success');
    setShowResetConfirm(false);
  };

  const handleThemeToggle = () => {
    toggleTheme();
    update({ darkMode: theme === 'light' });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text)' }}>
          设置
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          个性化你的学习体验
        </p>
      </div>

      {/* Study Settings */}
      <Section title="学习设置">
        <SettingRow
          icon={<Target size={18} />}
          iconBg="rgba(20,184,166,0.12)"
          iconColor="var(--teal-600)"
          title="每日学习目标"
          desc={`每天学习 ${settings.dailyGoal} 个单词`}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sfx.click();
                update({ dailyGoal: Math.max(5, settings.dailyGoal - 5) });
              }}
              className="flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer"
              style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
            >
              -
            </button>
            <span className="font-bold text-sm w-8 text-center" style={{ color: 'var(--text)' }}>
              {settings.dailyGoal}
            </span>
            <button
              onClick={() => {
                sfx.click();
                update({ dailyGoal: Math.min(100, settings.dailyGoal + 5) });
              }}
              className="flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer"
              style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
            >
              +
            </button>
          </div>
        </SettingRow>

        <SettingRow
          icon={<Sparkles size={18} />}
          iconBg="rgba(139,92,246,0.12)"
          iconColor="var(--violet-500)"
          title="每日新词目标"
          desc={`每天学习 ${settings.dailyNewGoal} 个新词`}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sfx.click();
                update({ dailyNewGoal: Math.max(3, settings.dailyNewGoal - 2) });
              }}
              className="flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer"
              style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
            >
              -
            </button>
            <span className="font-bold text-sm w-8 text-center" style={{ color: 'var(--text)' }}>
              {settings.dailyNewGoal}
            </span>
            <button
              onClick={() => {
                sfx.click();
                update({ dailyNewGoal: Math.min(50, settings.dailyNewGoal + 2) });
              }}
              className="flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer"
              style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
            >
              +
            </button>
          </div>
        </SettingRow>

        <SettingRow
          icon={<GraduationCap size={18} />}
          iconBg="rgba(20,184,166,0.12)"
          iconColor="var(--teal-600)"
          title="默认学习模式"
          desc="进入学习时默认使用的模式"
        >
          <select
            value={settings.studyMode}
            onChange={(e) => {
              sfx.click();
              update({ studyMode: e.target.value });
            }}
            className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
            style={{
              background: 'var(--surface-3)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
          >
            {STUDY_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </SettingRow>

        <SettingRow
          icon={<Eye size={18} />}
          iconBg="rgba(139,92,246,0.12)"
          iconColor="var(--violet-500)"
          title="专注模式"
          desc="隐藏不必要的干扰元素"
        >
          <Toggle
            checked={settings.focusMode}
            onChange={(v) => update({ focusMode: v })}
          />
        </SettingRow>

        <SettingRow
          icon={<Gauge size={18} />}
          iconBg="rgba(245,158,11,0.12)"
          iconColor="var(--amber-500)"
          title="反馈强度"
          desc="音效和动画的强度"
        >
          <div className="flex gap-1">
            {FEEDBACK_LEVELS.map((level) => (
              <button
                key={level.id}
                onClick={() => {
                  sfx.click();
                  update({ feedbackLevel: level.id });
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: settings.feedbackLevel === level.id ? 'var(--teal-600)' : 'var(--surface-3)',
                  color: settings.feedbackLevel === level.id ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {level.label}
              </button>
            ))}
          </div>
        </SettingRow>

        <SettingRow
          icon={<Sparkles size={18} />}
          iconBg="rgba(251,191,36,0.12)"
          iconColor="var(--amber-500)"
          title="卡片显示例句"
          desc="学习卡片上展示例句"
        >
          <Toggle
            checked={settings.examplesOnCard}
            onChange={(v) => update({ examplesOnCard: v })}
          />
        </SettingRow>

        <SettingRow
          icon={<RotateCcw size={18} />}
          iconBg="rgba(20,184,166,0.12)"
          iconColor="var(--teal-600)"
          title="答对后重复次数"
          desc={`答对的词重复 ${settings.repeatCorrect} 次`}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sfx.click();
                update({ repeatCorrect: Math.max(0, settings.repeatCorrect - 1) });
              }}
              className="flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer"
              style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
            >
              -
            </button>
            <span className="font-bold text-sm w-6 text-center" style={{ color: 'var(--text)' }}>
              {settings.repeatCorrect}
            </span>
            <button
              onClick={() => {
                sfx.click();
                update({ repeatCorrect: Math.min(5, settings.repeatCorrect + 1) });
              }}
              className="flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer"
              style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
            >
              +
            </button>
          </div>
        </SettingRow>

        <SettingRow
          icon={<ListChecks size={18} />}
          iconBg="rgba(20,184,166,0.12)"
          iconColor="var(--teal-600)"
          title="选择题选项数"
          desc="选择题中可选答案的数量"
        >
          <div className="flex gap-1">
            {QUIZ_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  sfx.click();
                  update({ quizOptionCount: opt.id });
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: settings.quizOptionCount === opt.id ? 'var(--teal-600)' : 'var(--surface-3)',
                  color: settings.quizOptionCount === opt.id ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingRow>

        <SettingRow
          icon={<FastForward size={18} />}
          iconBg="rgba(139,92,246,0.12)"
          iconColor="var(--violet-500)"
          title="答对后自动跳转"
          desc="答对后自动进入下一个单词"
        >
          <Toggle
            checked={settings.autoAdvance}
            onChange={(v) => update({ autoAdvance: v })}
          />
        </SettingRow>

        {settings.autoAdvance && (
          <SettingRow
            icon={<Clock size={18} />}
            iconBg="rgba(139,92,246,0.12)"
            iconColor="var(--violet-500)"
            title="自动跳转延迟"
            desc={`${settings.autoAdvanceDelay.toFixed(1)} 秒后跳转`}
          >
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={settings.autoAdvanceDelay}
                onChange={(e) => update({ autoAdvanceDelay: parseFloat(e.target.value) })}
                className="cursor-pointer"
                style={{ width: 80 }}
              />
            </div>
          </SettingRow>
        )}

        <SettingRow
          icon={<RefreshCw size={18} />}
          iconBg="rgba(20,184,166,0.12)"
          iconColor="var(--teal-600)"
          title="卡片自动翻转"
          desc="卡片模式下自动翻转到背面"
        >
          <Toggle
            checked={settings.cardAutoFlip}
            onChange={(v) => update({ cardAutoFlip: v })}
          />
        </SettingRow>

        {settings.cardAutoFlip && (
          <SettingRow
            icon={<Clock size={18} />}
            iconBg="rgba(20,184,166,0.12)"
            iconColor="var(--teal-600)"
            title="自动翻转延迟"
            desc={`${settings.cardAutoFlipDelay.toFixed(1)} 秒后翻转`}
          >
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={settings.cardAutoFlipDelay}
                onChange={(e) => update({ cardAutoFlipDelay: parseFloat(e.target.value) })}
                className="cursor-pointer"
                style={{ width: 80 }}
              />
            </div>
          </SettingRow>
        )}

        <SettingRow
          icon={<Tag size={18} />}
          iconBg="rgba(245,158,11,0.12)"
          iconColor="var(--amber-500)"
          title="显示词性标注"
          desc="在单词卡片上显示词性"
        >
          <Toggle
            checked={settings.showPOS}
            onChange={(v) => update({ showPOS: v })}
          />
        </SettingRow>

        <SettingRow
          icon={<Type size={18} />}
          iconBg="rgba(139,92,246,0.12)"
          iconColor="var(--violet-500)"
          title="字体大小"
          desc="单词卡片的字体大小"
        >
          <div className="flex gap-1">
            {FONT_SIZES.map((fs) => (
              <button
                key={fs.id}
                onClick={() => {
                  sfx.click();
                  update({ fontSize: fs.id });
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: settings.fontSize === fs.id ? 'var(--teal-600)' : 'var(--surface-3)',
                  color: settings.fontSize === fs.id ? '#fff' : 'var(--text-secondary)',
                  fontSize: fs.id === 'small' ? '11px' : fs.id === 'large' ? '15px' : '13px',
                }}
              >
                {fs.label}
              </button>
            ))}
          </div>
        </SettingRow>
      </Section>

      {/* Appearance */}
      <Section title="外观">
        <SettingRow
          icon={theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          iconBg={theme === 'dark' ? 'rgba(139,92,246,0.12)' : 'rgba(251,191,36,0.12)'}
          iconColor={theme === 'dark' ? 'var(--violet-500)' : 'var(--amber-500)'}
          title="深色模式"
          desc={theme === 'dark' ? '已启用深色主题' : '使用浅色主题'}
        >
          <Toggle
            checked={theme === 'dark'}
            onChange={handleThemeToggle}
          />
        </SettingRow>

        <SettingRow
          icon={<Sparkles size={18} />}
          iconBg="rgba(251,191,36,0.12)"
          iconColor="var(--amber-500)"
          title="显示奖励动画"
          desc="升级和成就的庆祝动画"
        >
          <Toggle
            checked={settings.showRewards}
            onChange={(v) => update({ showRewards: v })}
          />
        </SettingRow>
      </Section>

      {/* TTS Settings */}
      <Section title="语音朗读">
        <SettingRow
          icon={settings.ttsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          iconBg="rgba(20,184,166,0.12)"
          iconColor="var(--teal-600)"
          title="启用语音朗读"
          desc="使用 Web Speech API 朗读单词"
        >
          <Toggle
            checked={settings.ttsEnabled}
            onChange={(v) => update({ ttsEnabled: v })}
          />
        </SettingRow>

        {settings.ttsEnabled && (
          <>
            <SettingRow
              icon={<Volume2 size={18} />}
              iconBg="rgba(20,184,166,0.12)"
              iconColor="var(--teal-600)"
              title="自动朗读"
              desc="显示卡片时自动播放发音"
            >
              <Toggle
                checked={settings.ttsAutoPlay}
                onChange={(v) => update({ ttsAutoPlay: v })}
              />
            </SettingRow>

            <SettingRow
              icon={<Gauge size={18} />}
              iconBg="rgba(245,158,11,0.12)"
              iconColor="var(--amber-500)"
              title="朗读速度"
              desc={`${settings.ttsRate.toFixed(1)}x 速度`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.ttsRate}
                  onChange={(e) => update({ ttsRate: parseFloat(e.target.value) })}
                  className="cursor-pointer"
                  style={{ width: 80 }}
                />
                <button
                  onClick={() => ttsHook.speakWord('hello')}
                  className="flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer"
                  style={{ background: 'rgba(20,184,166,0.12)', color: 'var(--teal-600)' }}
                >
                  <Volume2 size={14} />
                </button>
              </div>
            </SettingRow>

            <SettingRow
              icon={<Volume2 size={18} />}
              iconBg="rgba(20,184,166,0.12)"
              iconColor="var(--teal-600)"
              title="朗读音量"
              desc={`${Math.round(settings.ttsVolume * 100)}% 音量`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.ttsVolume}
                  onChange={(e) => update({ ttsVolume: parseFloat(e.target.value) })}
                  className="cursor-pointer"
                  style={{ width: 80 }}
                />
              </div>
            </SettingRow>

            {ttsHook.voices.length > 0 && (
              <SettingRow
                icon={<Volume2 size={18} />}
                iconBg="rgba(20,184,166,0.12)"
                iconColor="var(--teal-600)"
                title="朗读声音"
                desc="选择英语发音引擎"
              >
                <select
                  value={settings.ttsVoice || ''}
                  onChange={(e) => {
                    sfx.click();
                    update({ ttsVoice: e.target.value || null });
                  }}
                  className="px-2 py-1.5 rounded-lg text-xs outline-none cursor-pointer max-w-[140px]"
                  style={{
                    background: 'var(--surface-3)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <option value="">默认</option>
                  {ttsHook.voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name.length > 20 ? v.name.slice(0, 20) + '...' : v.name}
                    </option>
                  ))}
                </select>
              </SettingRow>
            )}
          </>
        )}
      </Section>

      {/* Sound Effects */}
      <Section title="音效">
        <SettingRow
          icon={settings.sfxEnabled ? <Bell size={18} /> : <BellOff size={18} />}
          iconBg="rgba(139,92,246,0.12)"
          iconColor="var(--violet-500)"
          title="启用音效"
          desc="按钮点击和答题反馈音效"
        >
          <Toggle
            checked={settings.sfxEnabled}
            onChange={(v) => update({ sfxEnabled: v })}
          />
        </SettingRow>
      </Section>

      {/* Study Behavior */}
      <Section title="学习行为">
        <SettingRow
          icon={<EyeOff size={18} />}
          iconBg="rgba(139,92,246,0.12)"
          iconColor="var(--violet-500)"
          title="先回忆再翻转"
          desc="卡片模式中先尝试回忆再查看答案"
        >
          <Toggle
            checked={settings.recallFirst}
            onChange={(v) => update({ recallFirst: v })}
          />
        </SettingRow>
      </Section>

      {/* Data Management */}
      <Section title="数据管理">
        <SettingRow
          icon={<RotateCcw size={18} />}
          iconBg="rgba(220,38,38,0.1)"
          iconColor="#dc2626"
          title="重置设置"
          desc="恢复所有设置到默认值"
        >
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              sfx.click();
              setShowResetConfirm(true);
            }}
          >
            重置
          </Button>
        </SettingRow>
      </Section>

      {/* About */}
      <Card padding="md" className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <SettingsIcon size={18} style={{ color: 'var(--teal-600)' }} />
          <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>
            WordForge
          </span>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          版本 1.0.0 · 基于 SM-2 间隔重复算法
        </p>
      </Card>

      {/* Reset Confirmation Modal */}
      <Modal
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="确认重置"
      >
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          确定要重置所有设置吗？此操作不会影响你的学习进度和生词本数据。
        </p>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setShowResetConfirm(false)}
          >
            取消
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={handleReset}
          >
            <Check size={16} />
            确认重置
          </Button>
        </div>
      </Modal>
    </div>
  );
}
