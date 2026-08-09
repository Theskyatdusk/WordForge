/**
 * 商店 —— 对齐 web 端 pages/Shop.tsx。
 *
 * 迁移差异：
 *   - 分类图标由 lucide 组件 → Icon name 字符串
 *   - 横向滚动分类条 → <ScrollView scrollX>
 *   - applyTheme(id) 不再需要：主题变量由 PageShell 读 store.equippedTheme 注入根节点
 *   - grid-cols-2 → flex wrap 双列
 */
import { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { PageShell } from '../../components/ui/PageShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '../../components/Icon';
import { useProgressStore } from '../../store/useProgressStore';
import { useUIStore } from '../../store/useUIStore';
import { sfx } from '../../utils/sfx';
import { BADGES } from '../../utils/achievements';
import type { ShopItem } from '../../types/index';
import './index.scss';

interface ShopCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
  items: ShopItem[];
}

const CATEGORIES: ShopCategory[] = [
  {
    id: 'theme',
    label: '主题皮肤',
    icon: 'sparkles',
    color: '#8b5cf6',
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
    icon: 'zap',
    color: '#f59e0b',
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
    icon: 'star',
    color: '#0d9488',
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
    icon: 'heart',
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
    icon: 'award',
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

export default function ShopPage() {
  const coins = useProgressStore((s) => s.coins);
  const spendCoins = useProgressStore((s) => s.spendCoins);
  const addCoins = useProgressStore((s) => s.addCoins);
  const purchasedBadges = useProgressStore((s) => s.purchasedBadges);
  const equippedBadge = useProgressStore((s) => s.equippedBadge);
  const equipBadge = useProgressStore((s) => s.equipBadge);
  const purchaseBadge = useProgressStore((s) => s.purchaseBadge);
  const purchasedThemes = useProgressStore((s) => s.purchasedThemes);
  const equippedTheme = useProgressStore((s) => s.equippedTheme);
  const purchaseTheme = useProgressStore((s) => s.purchaseTheme);
  const equipTheme = useProgressStore((s) => s.equipTheme);
  const addToast = useUIStore((s) => s.addToast);

  const [activeCategory, setActiveCategory] = useState('theme');
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);

  const currentCategory = useMemo(
    () => CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0],
    [activeCategory],
  );

  const purchasedBadgeSet = useMemo(() => new Set(purchasedBadges), [purchasedBadges]);
  const purchasedThemeSet = useMemo(() => new Set(purchasedThemes), [purchasedThemes]);

  const confirmPurchase = () => {
    if (!confirmItem) return;
    const isBadge = confirmItem.id.startsWith('badge_');
    const isTheme = confirmItem.id.startsWith('theme_');
    let success: boolean;
    if (isBadge) {
      success = purchaseBadge(confirmItem.id, confirmItem.price);
    } else if (isTheme) {
      success = purchaseTheme(confirmItem.id, confirmItem.price);
    } else {
      success = spendCoins(confirmItem.price);
    }
    if (success) {
      sfx.success();
      if (!isBadge && !isTheme) {
        setPurchased((prev) => new Set(prev).add(confirmItem.id));
      }
      addToast(`已购买「${confirmItem.name}」`, 'success');
    } else {
      sfx.error();
      addToast('金币不足，继续学习赚取更多金币', 'error');
    }
    setConfirmItem(null);
  };

  const handleEarnCoins = () => {
    sfx.add();
    addCoins(10);
    addToast('获得 10 金币（测试用）', 'info');
  };

  return (
    <PageShell>
      <View className="wf-fade-in">
        {/* Header + 余额 */}
        <View className="wf-between sp__head">
          <View>
            <Text className="wf-h1">商店</Text>
            <Text className="wf-sub">用金币兑换主题和道具</Text>
          </View>
          <View className="sp__coins">
            <Icon name="coin" size={20} color="#f59e0b" />
            <Text className="sp__coins-num">{coins}</Text>
          </View>
        </View>

        {/* 分类横滑 */}
        <ScrollView scrollX enhanced showScrollbar={false} className="sp__cats">
          <View className="sp__cats-inner">
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <View
                  key={cat.id}
                  className="sp__cat"
                  style={{
                    background: active ? cat.bg : 'var(--surface)',
                    borderColor: active ? `${cat.color}44` : 'var(--border)',
                  }}
                  hoverClass="sp__cat--pressed"
                  onClick={() => {
                    sfx.click();
                    setActiveCategory(cat.id);
                  }}
                >
                  <Icon name={cat.icon} size={16} color={active ? cat.color : '#64748b'} />
                  <Text
                    className="sp__cat-text"
                    style={{ color: active ? cat.color : 'var(--text-secondary)' }}
                  >
                    {cat.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* 当前分类说明 */}
        <View className="sp__cur">
          <View className="sp__cur-icon" style={{ background: currentCategory.bg }}>
            <Icon name={currentCategory.icon} size={20} color={currentCategory.color} />
          </View>
          <View>
            <Text className="sp__cur-label">{currentCategory.label}</Text>
            <Text className="sp__cur-count">{currentCategory.items.length} 个商品</Text>
          </View>
        </View>

        {/* 商品双列 */}
        <View className="sp__grid">
          {currentCategory.items.map((item) => {
            const isBadge = item.id.startsWith('badge_');
            const isTheme = item.id.startsWith('theme_');
            const isOwned = isBadge
              ? purchasedBadgeSet.has(item.id)
              : isTheme
                ? purchasedThemeSet.has(item.id)
                : purchased.has(item.id);
            const canAfford = coins >= item.price;
            const isEquipped = isBadge
              ? equippedBadge === item.id
              : isTheme
                ? equippedTheme === item.id
                : false;

            return (
              <Card key={item.id} padding="md" className="sp__item">
                <View className="sp__item-emoji">
                  <Text className="sp__item-emoji-text">{item.emoji}</Text>
                </View>
                <Text className="sp__item-name">{item.name}</Text>
                <Text className="sp__item-desc">{item.desc}</Text>

                {isOwned ? (
                  isBadge || isTheme ? (
                    <View className="sp__item-actions">
                      {isEquipped ? (
                        <>
                          <View className="sp__badge sp__badge--on">
                            <Icon name="check-plain" size={16} color="#f59e0b" />
                            <Text className="sp__badge-text" style={{ color: '#f59e0b' }}>
                              已{isTheme ? '应用' : '装备'}
                            </Text>
                          </View>
                          <View
                            className="sp__unequip"
                            hoverClass="sp__cat--pressed"
                            onClick={() => {
                              sfx.click();
                              if (isTheme) {
                                equipTheme(null);
                                addToast('已恢复默认主题', 'info');
                              } else {
                                equipBadge(null);
                                addToast('已卸下徽章', 'info');
                              }
                            }}
                          >
                            <Text className="sp__unequip-text">
                              {isTheme ? '恢复默认' : '卸下'}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <View
                          className="sp__equip"
                          hoverClass="sp__cat--pressed"
                          onClick={() => {
                            sfx.click();
                            if (isTheme) {
                              equipTheme(item.id);
                              addToast(`已应用主题「${item.name}」`, 'success');
                            } else {
                              equipBadge(item.id);
                              addToast(`已装备「${item.name}」`, 'success');
                            }
                          }}
                        >
                          <Icon name={isTheme ? 'sparkles' : 'award'} size={16} color="#fff" />
                          <Text className="sp__equip-text">{isTheme ? '应用' : '装备'}</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View className="sp__badge sp__badge--owned">
                      <Icon name="check-plain" size={16} color="#16a34a" />
                      <Text className="sp__badge-text" style={{ color: '#16a34a' }}>
                        已拥有
                      </Text>
                    </View>
                  )
                ) : (
                  <View
                    className={`sp__buy ${canAfford ? '' : 'sp__buy--off'}`}
                    hoverClass={canAfford ? 'sp__cat--pressed' : 'none'}
                    onClick={() => {
                      if (!canAfford) {
                        sfx.error();
                        addToast('金币不足', 'error');
                        return;
                      }
                      sfx.click();
                      setConfirmItem(item);
                    }}
                  >
                    <Icon
                      name={canAfford ? 'coin' : 'lock'}
                      size={16}
                      color={canAfford ? '#fff' : '#94a3b8'}
                    />
                    <Text className="sp__buy-text">{item.price}</Text>
                  </View>
                )}
              </Card>
            );
          })}
        </View>

        {/* 赚币提示 */}
        <Card padding="md" className="sp__earn">
          <View className="sp__earn-icon">
            <Icon name="sparkles" size={20} color="#0d9488" />
          </View>
          <View className="sp__earn-body">
            <Text className="sp__earn-title">如何获取金币？</Text>
            <Text className="sp__earn-desc">每日打卡 +10 · 完成任务 +5~20 · 学习答题 +2~10</Text>
          </View>
          <Button size="sm" variant="secondary" onClick={handleEarnCoins}>
            +10
          </Button>
        </Card>

        {/* 购买确认 */}
        <Modal
          open={!!confirmItem}
          onClose={() => setConfirmItem(null)}
          title="确认购买"
          footer={
            confirmItem ? (
              <View className="sp__modal-actions">
                <Button variant="secondary" fullWidth onClick={() => setConfirmItem(null)}>
                  取消
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  disabled={coins < confirmItem.price}
                  onClick={confirmPurchase}
                >
                  <Icon name="bag" size={16} color="#fff" />
                  <Text className="sp__modal-btn-text">确认购买</Text>
                </Button>
              </View>
            ) : null
          }
        >
          {confirmItem && (
            <View className="sp__confirm">
              <View className="sp__confirm-emoji">
                <Text className="sp__confirm-emoji-text">{confirmItem.emoji}</Text>
              </View>
              <Text className="sp__confirm-name">{confirmItem.name}</Text>
              <Text className="sp__confirm-desc">{confirmItem.desc}</Text>
              <View className="sp__confirm-price">
                <Icon name="coin" size={20} color="#f59e0b" />
                <Text className="sp__confirm-price-num">{confirmItem.price}</Text>
                <Text className="sp__confirm-price-hint">/ 当前 {coins} 金币</Text>
              </View>
            </View>
          )}
        </Modal>
      </View>
    </PageShell>
  );
}
