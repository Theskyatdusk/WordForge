"""Static shop items: themes, badges, and daily task definitions."""

THEMES = [
    {"id": "default", "name": "默认", "emoji": "🌿", "desc": "Teal 主色调", "price": 0, "primary": "#0D9488"},
    {"id": "ocean", "name": "深海", "emoji": "🌊", "desc": "蓝色海洋", "price": 60, "primary": "#2563EB"},
    {"id": "sunset", "name": "日落", "emoji": "🌅", "desc": "暖橙色调", "price": 80, "primary": "#EA580C"},
    {"id": "rose", "name": "玫瑰", "emoji": "🌹", "desc": "粉红色调", "price": 100, "primary": "#DB2777"},
    {"id": "violet", "name": "紫罗兰", "emoji": "💜", "desc": "神秘紫色", "price": 120, "primary": "#7C3AED"},
    {"id": "gold", "name": "黄金", "emoji": "👑", "desc": "尊贵金色", "price": 150, "primary": "#CA8A04"},
]

BADGES = [
    {"id": "scholar", "name": "学者", "emoji": "🎓", "desc": "学习之路的开始", "price": 40},
    {"id": "warrior", "name": "勇士", "emoji": "⚔️", "desc": "征服词汇的战士", "price": 80},
    {"id": "master", "name": "大师", "emoji": "🏆", "desc": "词汇大师的徽章", "price": 150},
    {"id": "legend", "name": "传奇", "emoji": "👑", "desc": "传奇学习者的标志", "price": 200},
]

DAILY_TASKS = [
    {"id": "learn_goal", "desc": "完成今日学习目标", "reward": 10},
    {"id": "review_10", "desc": "复习10个词", "reward": 8},
    {"id": "spell_1", "desc": "完成1次拼写", "reward": 6},
    {"id": "perfect", "desc": "单轮全对", "reward": 5},
]


def get_theme(theme_id: str):
    """Return theme dict by id, or None."""
    for t in THEMES:
        if t["id"] == theme_id:
            return t
    return None


def get_badge(badge_id: str):
    """Return badge dict by id, or None."""
    for b in BADGES:
        if b["id"] == badge_id:
            return b
    return None


def get_shop_item(kind: str, item_id: str):
    """Return shop item by kind ('theme'/'badge') and id, or None."""
    if kind == "theme":
        return get_theme(item_id)
    elif kind == "badge":
        return get_badge(item_id)
    return None
