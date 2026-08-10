"""Shared utility functions for WordForge backend."""
from __future__ import annotations
import time
from datetime import date, timedelta
from typing import Any, Optional
from sqlalchemy.orm import Session

from models import (
    Item, Group, Section, Chapter, Setting, Streak, Equipped,
    DailyTask, StudySession, WordProgress,
)
from shop_data import DAILY_TASKS


# ============================================================
#  Word ID helpers
# ============================================================
def parse_word_id(word_id: str):
    """Parse 'ch1:0:0:0' -> ('ch1', 0, 0, 0).  Returns None on bad format."""
    parts = word_id.split(":")
    if len(parts) != 4:
        return None
    try:
        return parts[0], int(parts[1]), int(parts[2]), int(parts[3])
    except ValueError:
        return None


def get_item_by_word_id(db: Session, word_id: str) -> Optional[Item]:
    """Look up an Item by its computed word_id."""
    parsed = parse_word_id(word_id)
    if not parsed:
        return None
    chapter_id, section_idx, group_idx, item_idx = parsed
    return (
        db.query(Item)
        .join(Group, Item.group_id == Group.id)
        .join(Section, Group.section_id == Section.id)
        .join(Chapter, Section.chapter_id == Chapter.id)
        .filter(
            Chapter.id == chapter_id,
            Section.order == section_idx,
            Group.order == group_idx,
            Item.order == item_idx,
        )
        .first()
    )


def compute_word_id(chapter_id: str, section_order: int, group_order: int, item_order: int) -> str:
    """Build a word_id string from order fields."""
    return f"{chapter_id}:{section_order}:{group_order}:{item_order}"


def get_chapter_id_from_word_id(word_id: str) -> str:
    """Extract the chapter_id portion from a word_id."""
    return word_id.split(":")[0] if ":" in word_id else word_id


def get_all_word_ids(db: Session) -> list[dict]:
    """Return list of {word_id, en, zh, pos, chapter_id, chapter_title} for every item.

    Uses a single SQL JOIN instead of N+1 lazy loading.
    """
    rows = (
        db.query(
            Chapter.id.label("chapter_id"),
            Chapter.title.label("chapter_title"),
            Section.order.label("section_order"),
            Group.order.label("group_order"),
            Item.en,
            Item.zh,
            Item.pos,
            Item.order.label("item_order"),
        )
        .join(Section, Section.chapter_id == Chapter.id)
        .join(Group, Group.section_id == Section.id)
        .join(Item, Item.group_id == Group.id)
        .order_by(Chapter.order, Section.order, Group.order, Item.order)
        .all()
    )
    return [
        {
            "word_id": compute_word_id(r.chapter_id, r.section_order, r.group_order, r.item_order),
            "en": r.en,
            "zh": r.zh,
            "pos": r.pos,
            "chapter_id": r.chapter_id,
            "chapter_title": r.chapter_title,
        }
        for r in rows
    ]


# ============================================================
#  Settings helpers
# ============================================================
DEFAULT_SETTINGS: dict[str, Any] = {
    "dailyGoal": 20,
    "dailyNewGoal": 20,
    "studyMode": "adaptive",
    "darkMode": False,
    "ttsEnabled": True,
    "ttsRate": 0.9,
    "ttsAutoPlay": True,
    "sfxEnabled": True,
    "focusMode": False,
    "feedbackLevel": "strong",
    "showRewards": True,
    "examplesOnCard": True,
    "recallFirst": False,
    "repeatCorrect": 2,
    "coins": 0,
}


def get_setting(db: Session, key: str, default: Any = None) -> Any:
    """Read a single setting value, falling back to DEFAULT_SETTINGS then *default*."""
    s = db.query(Setting).filter(Setting.key == key).first()
    if s:
        return s.value
    if key in DEFAULT_SETTINGS:
        return DEFAULT_SETTINGS[key]
    return default


def set_setting(db: Session, key: str, value: Any) -> None:
    """Insert or update a setting."""
    s = db.query(Setting).filter(Setting.key == key).first()
    if s:
        s.value = value
    else:
        db.add(Setting(key=key, value=value))


def get_all_settings(db: Session) -> dict[str, Any]:
    """Return merged settings (DB overrides defaults)."""
    merged = dict(DEFAULT_SETTINGS)
    for s in db.query(Setting).all():
        merged[s.key] = s.value
    return merged


def ensure_default_settings(db: Session) -> None:
    """Insert default settings rows if they don't exist yet."""
    for key, value in DEFAULT_SETTINGS.items():
        existing = db.query(Setting).filter(Setting.key == key).first()
        if not existing:
            db.add(Setting(key=key, value=value))
    db.commit()


# ============================================================
#  Coin helpers
# ============================================================
def get_coins(db: Session) -> int:
    """Return current coin balance."""
    val = get_setting(db, "coins", 0)
    try:
        return int(val)
    except (TypeError, ValueError):
        return 0


def _safe_int_coins(val: Any) -> int:
    """Safely convert a setting value to int, defaulting to 0 on failure."""
    try:
        return int(val) if val is not None else 0
    except (TypeError, ValueError):
        return 0


def add_coins(db: Session, amount: int, commit: bool = True) -> None:
    """Add coins to the singleton 'coins' setting row.

    Uses a direct query-update pattern (instead of get_coins + set_setting)
    to reduce the TOCTOU window.  When *commit* is False the caller is
    responsible for committing the transaction (useful for atomic
    multi-step operations such as shop purchases).
    """
    setting = db.query(Setting).filter(Setting.key == "coins").first()
    if not setting:
        setting = Setting(key="coins", value="0")
        db.add(setting)
    current = _safe_int_coins(setting.value)
    setting.value = str(current + amount)
    if commit:
        db.commit()


def spend_coins(db: Session, amount: int, commit: bool = True) -> bool:
    """Deduct coins if balance is sufficient.  Returns True on success.

    Uses a direct query-update pattern to reduce the TOCTOU window.
    When *commit* is False the deduction is staged but not committed,
    allowing the caller to commit it atomically with other changes.
    """
    setting = db.query(Setting).filter(Setting.key == "coins").first()
    if not setting:
        return False
    current = _safe_int_coins(setting.value)
    if current < amount:
        return False
    setting.value = str(current - amount)
    if commit:
        db.commit()
    return True


# ============================================================
#  Streak helpers
# ============================================================
def get_streak(db: Session) -> Streak:
    """Get or create the singleton streak row."""
    streak = db.query(Streak).filter(Streak.id == 1).first()
    if not streak:
        streak = Streak(id=1, current=0, longest=0, last_check_in=None)
        db.add(streak)
        db.commit()
    return streak


def get_equipped(db: Session) -> Equipped:
    """Get or create the singleton equipped row."""
    equipped = db.query(Equipped).filter(Equipped.id == 1).first()
    if not equipped:
        equipped = Equipped(id=1, theme="default", badge="")
        db.add(equipped)
        db.commit()
    return equipped


# ============================================================
#  Date helpers
# ============================================================
def today_str() -> str:
    return date.today().isoformat()


def yesterday_str() -> str:
    return (date.today() - timedelta(days=1)).isoformat()


def today_start_ts() -> float:
    """Unix timestamp for midnight today."""
    return time.mktime(date.today().timetuple())


# ============================================================
#  Daily task helpers
# ============================================================
def ensure_daily_tasks(db: Session) -> list[DailyTask]:
    """Create today's DailyTask rows if they don't exist, return all of today's tasks."""
    today = today_str()
    existing = (
        db.query(DailyTask)
        .filter(DailyTask.date == today)
        .all()
    )
    if len(existing) == len(DAILY_TASKS):
        return existing

    existing_ids = {t.task_id for t in existing}
    for dt_def in DAILY_TASKS:
        if dt_def["id"] not in existing_ids:
            db.add(DailyTask(
                date=today,
                task_id=dt_def["id"],
                completed=False,
                claimed=False,
            ))
    db.commit()
    return (
        db.query(DailyTask)
        .filter(DailyTask.date == today)
        .all()
    )


def check_and_complete_daily_tasks(db: Session) -> list[str]:
    """
    Auto-complete daily tasks whose conditions are met.
    Returns list of task_ids that were newly completed.
    """
    ensure_daily_tasks(db)
    today = today_str()
    tasks = db.query(DailyTask).filter(DailyTask.date == today).all()
    newly_completed: list[str] = []

    # Gather data needed for checks
    settings = get_all_settings(db)
    daily_goal = settings.get("dailyGoal", 20)

    session = db.query(StudySession).filter(StudySession.date == today).first()
    words_today = session.words_studied if session else 0
    modes_today: list[str] = session.modes if session and session.modes else []

    # Count words reviewed today (last_review >= today start)
    ts_start = today_start_ts()
    reviewed_today = (
        db.query(WordProgress)
        .filter(WordProgress.last_review >= ts_start)
        .count()
    )

    for task in tasks:
        if task.completed:
            continue
        should_complete = False
        if task.task_id == "learn_goal":
            should_complete = words_today >= daily_goal
        elif task.task_id == "review_10":
            should_complete = reviewed_today >= 10
        elif task.task_id == "spell_1":
            should_complete = "spelling" in modes_today
        elif task.task_id == "perfect":
            # A session today with 100% accuracy and >= 10 words
            if session and session.words_studied >= 10 and session.wrong == 0 and session.sessions > 0:
                should_complete = True

        if should_complete:
            task.completed = True
            newly_completed.append(task.task_id)

    if newly_completed:
        db.commit()
    return newly_completed
