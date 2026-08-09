/**
 * Shop — Virtual shop with coin-based purchases for themes, boosters, and cosmetics.
 */
import { useState, useMemo } from 'react';
import {
  Coins,
  ShoppingBag,
  Check,
  Lock,
  Sparkles,
  Zap,
  Palette,
  Gift,
  Crown,
  Award,
} from 'lucide-react';
import { useProgressStore } from '../store/useProgressStore';
import { useUIStore } from '../store/useUIStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { sfx } from '../utils/sfx';
import { BADGES } from '../utils/achievements';
import { applyTheme } from '../utils/themeSchemes';
import type { ShopItem } from '../types/index';

interface ShopCategory {
  id: string;
  label: string;
  icon: typeof Palette;
  color: string;
  bg: string;
  items: ShopItem[];
}

const CATEGORIES: ShopCategory[] = [
  {
    id: 'theme',
    label: '主题皮肤',
    icon: Palette,
    color: 'var(--violet-500)',
    bg: 'rgba(139,92,246,0.12)',
    items: [
      { id: 'theme_ocean', name: '深海蓝', emoji: '🌊', desc: '清新的海洋色调主题', price: 50 },
      { id: 'theme_forest', name: '森林绿', emoji: '🌲', desc: '宁静的自然绿色调', price: 50 },
      { id: 'theme_sunset', name: '日落橙', emoji: '🌅', desc: '温暖的夕阳色彩', price: 80 },
      { id: 'theme_aurora', name: '极光紫', emoji: '🌌', desc: '梦幻的极光渐变', price: 100 },
      { id: 'theme_sakura', name: '樱花粉', emoji: '🌸', desc: '浪漫的樱花粉色', price: 100 },
      { id: 'theme_midnight', name: '午夜黑', emoji: '🌃', desc: '深邃的暗夜风格', price: 120 },
    ],
  },
  {
    id: 'booster',
    label: '学习加速',
    icon: Zap,
    color: 'var(--amber-500)',
    bg: 'rgba(245,158,11,0.12)',
    items: [
      { id: 'booster_double_xp', name: '双倍经验', emoji: '⚡', desc: '下次学习获得双倍 XP', price: 30 },
      { id: 'booster_streak_protect', name: '连胜保护', emoji: '🛡️', desc: '保护一次打卡不断', price: 40 },
      { id: 'booster_skip', name: '跳过卡片', emoji: '⏭️', desc: '跳过 5 个不熟悉的词', price: 25 },
      { id: 'booster_hint', name: '提示包', emoji: '💡', desc: '获得 10 次答题提示', price: 20 },
    ],
  },
  {
    id: 'avatar',
    label: '头像框',
    icon: Crown,
    color: 'var(--teal-600)',
    bg: 'rgba(20,184,166,0.12)',
    items: [
      { id: 'avatar_bronze', name: '铜质边框', emoji: '🥉', desc: '基础铜色头像框', price: 30 },
      { id: 'avatar_silver', name: '银质边框', emoji: '🥈', desc: '闪亮银色头像框', price: 60 },
      { id: 'avatar_gold', name: '金质边框', emoji: '🥇', desc: '尊贵金色头像框', price: 100 },
      { id: 'avatar_diamond', name: '钻石边框', emoji: '💎', desc: '璀璨钻石头像框', price: 200 },
    ],
  },
  {
    id: 'special',
    label: '特别道具',
    icon: Gift,
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.12)',
    items: [
      { id: 'special_title_scholar', name: '学者称号', emoji: '🎓', desc: '解锁「学者」头衔', price: 150 },
      { id: 'special_title_master', name: '大师称号', emoji: '👑', desc: '解锁「词汇大师」头衔', price: 300 },
      { id: 'special_stats_reset', name: '进度重置券', emoji: '🔄', desc: '重置所有学习进度', price: 50 },
    ],
  },
  {
    id: 'badge',
    label: '徽章',
    icon: Award,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    items: BADGES.map((b) => ({
      id: b.id,
      name: b.name,
      emoji: b.emoji,
      desc: b.desc,
      price: b.price,
    })),
  },
];

export function Shop() {
  const coins = useProgressStore((s) => s.coins);
  const purchasedBadges = useProgressStore((s) => s.purchasedBadges);
  const equippedBadge = useProgressStore((s) => s.equippedBadge);
  const equipBadge = useProgressStore((s) => s.equipBadge);
  const purchaseBadge = useProgressStore((s) => s.purchaseBadge);
  const purchasedThemes = useProgressStore((s) => s.purchasedThemes);
  const equippedTheme = useProgressStore((s) => s.equippedTheme);
  const purchaseTheme = useProgressStore((s) => s.purchaseTheme);
  const equipTheme = useProgressStore((s) => s.equipTheme);
  const purchasedItems = useProgressStore((s) => s.purchasedItems);
  const purchaseItem = useProgressStore((s) => s.purchaseItem);
  const addToast = useUIStore((s) => s.addToast);

  const [activeCategory, setActiveCategory] = useState<string>('theme');
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentCategory = useMemo(
    () => CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0],
    [activeCategory],
  );

  const purchasedBadgeSet = useMemo(() => new Set(purchasedBadges), [purchasedBadges]);
  const purchasedThemeSet = useMemo(() => new Set(purchasedThemes), [purchasedThemes]);
  const purchasedItemSet = useMemo(() => new Set(purchasedItems), [purchasedItems]);

  const handlePurchase = (item: ShopItem) => {
    setConfirmItem(item);
    sfx.click();
  };

  const confirmPurchase = () => {
    if (!confirmItem) return;
    setIsProcessing(true);
    try {
      const isBadge = confirmItem.id.startsWith('badge_');
      const isTheme = confirmItem.id.startsWith('theme_');
      let success: boolean;
      if (isBadge) {
        success = purchaseBadge(confirmItem.id, confirmItem.price);
      } else if (isTheme) {
        success = purchaseTheme(confirmItem.id, confirmItem.price);
      } else {
        success = purchaseItem(confirmItem.id, confirmItem.price);
      }
      if (success) {
        sfx.success();
        addToast(`已购买「${confirmItem.name}」`, 'success');
      } else {
        sfx.error();
        addToast('金币不足，继续学习赚取更多金币', 'error');
      }
      setConfirmItem(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header with coin balance */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text)' }}>
            商店
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            用金币兑换主题和道具
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          <Coins size={20} style={{ color: 'var(--amber-500)' }} />
          <span className="font-bold text-lg" style={{ color: 'var(--amber-500)' }}>
            {coins}
          </span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                sfx.click();
                setActiveCategory(cat.id);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0"
              style={{
                background: active ? cat.bg : 'var(--surface)',
                color: active ? cat.color : 'var(--text-secondary)',
                border: `1px solid ${active ? cat.color + '44' : 'var(--border)'}`,
              }}
            >
              <Icon size={16} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Category Icon + Description */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl"
          style={{ background: currentCategory.bg, color: currentCategory.color }}
        >
          <currentCategory.icon size={20} />
        </div>
        <div>
          <h2 className="font-bold text-sm" style={{ color: 'var(--text)' }}>
            {currentCategory.label}
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {currentCategory.items.length} 个商品
          </p>
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-2 gap-3">
        {currentCategory.items.map((item) => {
          const isBadge = item.id.startsWith('badge_');
          const isTheme = item.id.startsWith('theme_');
          const isOwned = isBadge
            ? purchasedBadgeSet.has(item.id)
            : isTheme
              ? purchasedThemeSet.has(item.id)
              : purchasedItemSet.has(item.id);
          const canAfford = coins >= item.price;
          const isEquipped = isBadge
            ? equippedBadge === item.id
            : isTheme
              ? equippedTheme === item.id
              : false;
          return (
            <Card key={item.id} padding="md" className="flex flex-col items-center text-center">
              {/* Emoji */}
              <div
                className="flex items-center justify-center w-16 h-16 rounded-2xl text-3xl mb-3"
                style={{ background: 'var(--surface-2)' }}
              >
                {item.emoji}
              </div>

              {/* Name */}
              <p className="font-bold text-sm mb-1" style={{ color: 'var(--text)' }}>
                {item.name}
              </p>

              {/* Description */}
              <p className="text-xs mb-3 flex-1" style={{ color: 'var(--text-tertiary)' }}>
                {item.desc}
              </p>

              {/* Price / Owned / Equip */}
              {isOwned ? (
                (isBadge || isTheme) ? (
                  <div className="flex flex-col gap-2 w-full">
                    {isEquipped ? (
                      <div
                        className="flex items-center gap-1 px-3 py-2 rounded-lg justify-center"
                        style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--amber-500)' }}
                      >
                        <Check size={16} />
                        <span className="text-sm font-bold">已{isTheme ? '应用' : '装备'}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          sfx.click();
                          if (isTheme) {
                            equipTheme(item.id);
                            applyTheme(item.id);
                            addToast(`已应用主题「${item.name}」`, 'success');
                          } else {
                            equipBadge(item.id);
                            addToast(`已装备「${item.name}」`, 'success');
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg w-full justify-center cursor-pointer transition-all"
                        style={{ background: 'var(--teal-600)', color: '#fff' }}
                      >
                        {isTheme ? <Palette size={16} /> : <Award size={16} />}
                        <span className="text-sm font-bold">{isTheme ? '应用' : '装备'}</span>
                      </button>
                    )}
                    {isEquipped && (
                      <button
                        onClick={() => {
                          sfx.click();
                          if (isTheme) {
                            equipTheme(null);
                            applyTheme(null);
                            addToast('已恢复默认主题', 'info');
                          } else {
                            equipBadge(null);
                            addToast('已卸下徽章', 'info');
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg w-full justify-center cursor-pointer transition-all text-xs"
                        style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
                      >
                        {isTheme ? '恢复默认' : '卸下'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-1 px-3 py-2 rounded-lg w-full justify-center"
                    style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
                  >
                    <Check size={16} />
                    <span className="text-sm font-bold">已拥有</span>
                  </div>
                )
              ) : (
                <button
                  onClick={() => handlePurchase(item)}
                  disabled={!canAfford}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg w-full justify-center cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: canAfford ? 'var(--amber-500)' : 'var(--surface-3)',
                    color: canAfford ? '#fff' : 'var(--text-tertiary)',
                  }}
                >
                  {canAfford ? (
                    <Coins size={16} />
                  ) : (
                    <Lock size={16} />
                  )}
                  <span className="text-sm font-bold">{item.price}</span>
                </button>
              )}
            </Card>
          );
        })}
      </div>

      {/* Earn coins hint */}
      <Card padding="md" className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
          style={{ background: 'rgba(20,184,166,0.12)', color: 'var(--teal-600)' }}
        >
          <Sparkles size={20} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            如何获取金币？
          </p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            每日打卡 +10 · 完成任务 +5~20 · 学习答题 +2~10
          </p>
        </div>
      </Card>

      {/* Purchase Confirmation Modal */}
      <Modal
        open={!!confirmItem}
        onClose={() => setConfirmItem(null)}
        title="确认购买"
      >
        {confirmItem && (
          <div className="text-center">
            <div
              className="flex items-center justify-center w-20 h-20 rounded-2xl text-4xl mx-auto mb-4"
              style={{ background: 'var(--surface-2)' }}
            >
              {confirmItem.emoji}
            </div>
            <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text)' }}>
              {confirmItem.name}
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {confirmItem.desc}
            </p>

            <div
              className="flex items-center justify-center gap-2 py-3 rounded-xl mb-4"
              style={{ background: 'rgba(245,158,11,0.1)' }}
            >
              <Coins size={20} style={{ color: 'var(--amber-500)' }} />
              <span className="font-bold text-lg" style={{ color: 'var(--amber-500)' }}>
                {confirmItem.price}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                / 当前 {coins} 金币
              </span>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setConfirmItem(null)}
              >
                取消
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={confirmPurchase}
                disabled={coins < confirmItem.price || isProcessing}
              >
                <ShoppingBag size={16} />
                确认购买
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
